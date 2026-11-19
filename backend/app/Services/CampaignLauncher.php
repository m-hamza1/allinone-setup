<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\ChannelConnection;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Inbox;
use App\Models\Message;
use Illuminate\Support\Collection;

class CampaignLauncher
{
    /**
     * Resolve audience and deliver campaign message.
     *
     * @return array{sent: int, failed: int, skipped: int, details: list<array<string, mixed>>}
     */
    public function launch(Campaign $campaign): array
    {
        $audience = is_array($campaign->audience) ? $campaign->audience : [];
        $channel = (string) ($audience['channel'] ?? $campaign->campaign_type ?? 'whatsapp');
        if ($channel === 'live_chat') {
            $channel = 'website';
        }
        if ($channel === 'one_off' || $channel === 'ongoing') {
            $channel = 'whatsapp';
        }

        $contacts = $this->resolveContacts($campaign, $audience, $channel);
        $sent = 0;
        $failed = 0;
        $skipped = 0;
        $details = [];

        foreach ($contacts as $contact) {
            $result = $this->deliverOne($campaign, $contact, $channel);
            $details[] = [
                'contact_id' => $contact->id,
                'ok' => $result['ok'],
                'mode' => $result['mode'] ?? null,
                'detail' => $result['detail'] ?? null,
            ];
            if (($result['skipped'] ?? false) === true) {
                $skipped++;
            } elseif ($result['ok']) {
                $sent++;
            } else {
                $failed++;
            }
        }

        $meta = $campaign->audience ?? [];
        $meta['last_launch'] = [
            'at' => now()->toIso8601String(),
            'sent' => $sent,
            'failed' => $failed,
            'skipped' => $skipped,
            'channel' => $channel,
            'audience_count' => $contacts->count(),
        ];

        $campaign->update([
            'status' => 'completed',
            'launched_at' => now(),
            'audience' => $meta,
        ]);

        return compact('sent', 'failed', 'skipped', 'details');
    }

    /**
     * @param  array<string, mixed>  $audience
     * @return Collection<int, Contact>
     */
    private function resolveContacts(Campaign $campaign, array $audience, string $channel): Collection
    {
        $labelIds = collect($audience['label_ids'] ?? [])->filter()->map(fn ($id) => (int) $id)->all();

        $query = Contact::query()->where('account_id', $campaign->account_id);

        if ($labelIds !== []) {
            $contactIds = Conversation::query()
                ->where('account_id', $campaign->account_id)
                ->whereHas('labels', fn ($q) => $q->whereIn('labels.id', $labelIds))
                ->pluck('contact_id')
                ->unique()
                ->all();
            $query->whereIn('id', $contactIds ?: [0]);
        }

        if (in_array($channel, ['whatsapp', 'sms'], true)) {
            $query->where(function ($q) use ($channel) {
                $q->whereNotNull('phone')->where('phone', '!=', '');
                $attr = $channel === 'whatsapp' ? 'whatsapp_id' : 'sms_id';
                $q->orWhereNotNull("custom_attributes->{$attr}");
            });
        } elseif ($channel === 'email') {
            $query->whereNotNull('email')->where('email', '!=', '');
        }

        return $query->orderBy('id')->limit(500)->get();
    }

    /**
     * @return array{ok: bool, skipped?: bool, mode?: string, detail?: string}
     */
    private function deliverOne(Campaign $campaign, Contact $contact, string $channel): array
    {
        if ($channel === 'website' || $channel === 'live_chat') {
            return $this->deliverLiveChatNote($campaign, $contact);
        }

        $connection = ChannelConnection::query()
            ->where('account_id', $campaign->account_id)
            ->where('provider', $channel === 'email' ? 'email' : $channel)
            ->when(
                $campaign->inbox_id,
                fn ($q) => $q->where(fn ($inner) => $inner
                    ->where('inbox_id', $campaign->inbox_id)
                    ->orWhereNull('inbox_id')),
            )
            ->orderByDesc('id')
            ->first();

        if (! $connection && $channel !== 'email') {
            return ['ok' => false, 'detail' => "No {$channel} channel connection"];
        }

        if ($channel === 'email') {
            return $this->deliverEmail($campaign, $contact);
        }

        $to = match ($channel) {
            'whatsapp' => $contact->phone ?? ($contact->custom_attributes['whatsapp_id'] ?? null),
            'sms' => $contact->phone ?? ($contact->custom_attributes['sms_id'] ?? null),
            'facebook' => $contact->custom_attributes['facebook_id'] ?? null,
            'instagram' => $contact->custom_attributes['instagram_id'] ?? null,
            default => null,
        };

        if (! $to) {
            return ['ok' => false, 'skipped' => true, 'detail' => 'Missing destination'];
        }

        if ($channel === 'whatsapp') {
            $to = preg_replace('/\D+/', '', (string) $to) ?: (string) $to;
        }

        $result = app(SocialChannelAdapter::class)->send($connection, (string) $to, $campaign->message);

        return [
            'ok' => (bool) ($result['ok'] ?? false),
            'mode' => $result['mode'] ?? null,
            'detail' => $result['detail'] ?? null,
        ];
    }

    /**
     * @return array{ok: bool, mode: string, detail: string}
     */
    private function deliverEmail(Campaign $campaign, Contact $contact): array
    {
        if (! $contact->email) {
            return ['ok' => false, 'skipped' => true, 'mode' => 'stub', 'detail' => 'No email'];
        }

        try {
            $result = app(EmailChannelService::class)->sendOutbound(
                $campaign->account_id,
                (string) $contact->email,
                $campaign->title,
                $campaign->message,
                $campaign->inbox_id,
            );

            return [
                'ok' => (bool) ($result['ok'] ?? false),
                'mode' => $result['mode'] ?? 'live',
                'detail' => $result['detail'] ?? 'sent',
            ];
        } catch (\Throwable $e) {
            // Fallback: create campaign conversation note if outbound helper missing
            return $this->deliverLiveChatNote($campaign, $contact, asCampaign: true);
        }
    }

    /**
     * @return array{ok: bool, mode: string, detail: string}
     */
    private function deliverLiveChatNote(Campaign $campaign, Contact $contact, bool $asCampaign = false): array
    {
        $inbox = $campaign->inbox_id
            ? Inbox::query()->find($campaign->inbox_id)
            : Inbox::query()
                ->where('account_id', $campaign->account_id)
                ->where('channel', 'website')
                ->orderBy('id')
                ->first();

        if (! $inbox) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => 'No website inbox'];
        }

        $conversation = Conversation::query()->create([
            'account_id' => $campaign->account_id,
            'inbox_id' => $inbox->id,
            'contact_id' => $contact->id,
            'status' => 'open',
            'last_activity_at' => now(),
        ]);

        Message::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => null,
            'sender_type' => 'staff',
            'private' => false,
            'body' => $campaign->message,
        ]);

        return [
            'ok' => true,
            'mode' => 'live',
            'detail' => $asCampaign ? 'Campaign message queued as conversation' : 'Live chat campaign message created',
        ];
    }
}
