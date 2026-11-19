<?php

namespace App\Services;

use App\Models\ChannelConnection;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Inbox;
use App\Models\Message;
use RuntimeException;

/**
 * Provider adapters for WhatsApp / Instagram / Facebook / SMS.
 * Live Meta/Twilio credentials unlock outbound send; inbound webhooks work in stub mode.
 */
class SocialChannelAdapter
{
    public function ingest(string $provider, array $payload): Conversation
    {
        if (! in_array($provider, ['whatsapp', 'instagram', 'facebook', 'sms', 'telegram', 'api', 'twitter', 'line'], true)) {
            throw new RuntimeException('Unsupported social provider');
        }

        $connection = ChannelConnection::query()
            ->where('provider', $provider)
            ->when(! empty($payload['account_id']), fn ($q) => $q->where('account_id', $payload['account_id']))
            ->firstOrFail();

        if ($connection->status !== 'connected') {
            $connection->update(['status' => 'connected']);
        }

        $inbox = $connection->inbox_id
            ? Inbox::query()->findOrFail($connection->inbox_id)
            : Inbox::query()->firstOrCreate(
                [
                    'account_id' => $connection->account_id,
                    'channel' => $provider,
                ],
                [
                    'name' => ucfirst($provider),
                    'channel_config' => $connection->meta ?? [],
                ],
            );

        $identity = (string) ($payload['from'] ?? $payload['from_phone'] ?? $payload['from_id'] ?? 'unknown');
        $attrKey = "{$provider}_id";

        $contact = Contact::query()
            ->where('account_id', $connection->account_id)
            ->where("custom_attributes->{$attrKey}", $identity)
            ->first();

        if (! $contact && in_array($provider, ['whatsapp', 'sms'], true)) {
            $contact = Contact::query()
                ->where('account_id', $connection->account_id)
                ->where('phone', $identity)
                ->first();
        }

        if (! $contact) {
            $contact = Contact::query()->create([
                'account_id' => $connection->account_id,
                'name' => $payload['from_name'] ?? $identity,
                'email' => null,
                'phone' => in_array($provider, ['whatsapp', 'sms'], true) ? $identity : null,
                'custom_attributes' => [$attrKey => $identity],
            ]);
        } else {
            $attrs = $contact->custom_attributes ?? [];
            $attrs[$attrKey] = $identity;
            $contact->update([
                'custom_attributes' => $attrs,
                'phone' => $contact->phone ?: (in_array($provider, ['whatsapp', 'sms'], true) ? $identity : $contact->phone),
            ]);
        }

        $conversation = Conversation::query()
            ->where('inbox_id', $inbox->id)
            ->where('contact_id', $contact->id)
            ->where('status', 'open')
            ->orderByDesc('id')
            ->first();

        $isNew = false;
        if (! $conversation) {
            $conversation = Conversation::query()->create([
                'account_id' => $connection->account_id,
                'inbox_id' => $inbox->id,
                'contact_id' => $contact->id,
                'status' => 'open',
                'last_activity_at' => now(),
            ]);
            $isNew = true;
            app(ConversationSlaService::class)->apply($conversation);
            try {
                app(AutomationRunner::class)->run('conversation_created', $conversation->fresh());
            } catch (\Throwable) {
                // best-effort automation
            }
        }

        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => null,
            'sender_type' => 'customer',
            'private' => false,
            'body' => $payload['body'] ?? $payload['text'] ?? '(empty)',
        ]);

        $conversation->update(['last_activity_at' => now(), 'status' => 'open']);

        $fresh = $conversation->fresh(['contact', 'inbox', 'messages', 'account']);

        if (! $isNew) {
            try {
                app(AutomationRunner::class)->run('message_created', $fresh);
            } catch (\Throwable) {
                // best-effort automation
            }
        }

        try {
            app(IntegrationDispatcher::class)->dispatch(
                $isNew ? 'conversation_created' : 'message_created',
                $fresh,
                $message,
            );
        } catch (\Throwable) {
            // best-effort integrations
        }

        try {
            app(CaptainAiService::class)->maybeAssistOnInbound($fresh, $message);
        } catch (\Throwable) {
            // best-effort captain
        }

        return $fresh;
    }

    /**
     * Outbound send — live for WhatsApp Cloud / Meta Messenger / Twilio SMS when credentials exist.
     *
     * @return array{ok: bool, provider: string, mode: string, detail: string}
     */
    public function send(ChannelConnection $connection, string $to, string $body): array
    {
        if ($connection->provider === 'whatsapp') {
            $result = app(WhatsAppCloudService::class)->sendMessage($connection, $to, $body);

            return [
                'ok' => $result['ok'],
                'provider' => 'whatsapp',
                'mode' => $result['mode'],
                'detail' => $result['detail'],
            ];
        }

        if (in_array($connection->provider, ['instagram', 'facebook'], true)) {
            $result = app(MetaMessengerService::class)->sendMessage($connection, $to, $body);

            return [
                'ok' => $result['ok'],
                'provider' => $connection->provider,
                'mode' => $result['mode'],
                'detail' => $result['detail'],
            ];
        }

        if ($connection->provider === 'sms') {
            $result = app(TwilioSmsService::class)->sendMessage($connection, $to, $body);

            return [
                'ok' => $result['ok'],
                'provider' => 'sms',
                'mode' => $result['mode'],
                'detail' => $result['detail'],
            ];
        }

        if ($connection->provider === 'telegram') {
            $creds = $connection->credentials ?? [];
            $botToken = $creds['bot_token'] ?? null;
            if (! $botToken) {
                return [
                    'ok' => false,
                    'provider' => 'telegram',
                    'mode' => 'stub',
                    'detail' => 'Missing bot_token',
                ];
            }

            try {
                $response = \Illuminate\Support\Facades\Http::timeout(20)
                    ->post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                        'chat_id' => $to,
                        'text' => $body,
                    ]);
            } catch (\Throwable $e) {
                return [
                    'ok' => false,
                    'provider' => 'telegram',
                    'mode' => 'live',
                    'detail' => $e->getMessage(),
                ];
            }

            return [
                'ok' => $response->successful(),
                'provider' => 'telegram',
                'mode' => 'live',
                'detail' => $response->successful()
                    ? 'Message sent'
                    : ($response->json('description') ?? $response->body()),
            ];
        }

        if ($connection->provider === 'api') {
            return $this->sendHttpWebhook($connection, $to, $body, 'api');
        }

        if ($connection->provider === 'twitter') {
            $creds = $connection->credentials ?? [];
            $bearer = $creds['bearer_token'] ?? null;
            $dmUrl = $creds['dm_url'] ?? null;
            if (! $bearer) {
                return [
                    'ok' => false,
                    'provider' => 'twitter',
                    'mode' => 'stub',
                    'detail' => 'Missing bearer_token',
                ];
            }
            // X API DM endpoint can vary by app tier — allow override URL, else acknowledge queued.
            if (! $dmUrl) {
                return [
                    'ok' => true,
                    'provider' => 'twitter',
                    'mode' => 'queued',
                    'detail' => "Would DM {$to} via X API (set dm_url for live send)",
                ];
            }

            try {
                $response = \Illuminate\Support\Facades\Http::withToken($bearer)
                    ->timeout(20)
                    ->post($dmUrl, ['to' => $to, 'text' => $body]);

                return [
                    'ok' => $response->successful(),
                    'provider' => 'twitter',
                    'mode' => 'live',
                    'detail' => $response->successful() ? 'DM sent' : ($response->body()),
                ];
            } catch (\Throwable $e) {
                return ['ok' => false, 'provider' => 'twitter', 'mode' => 'live', 'detail' => $e->getMessage()];
            }
        }

        if ($connection->provider === 'line') {
            $creds = $connection->credentials ?? [];
            $token = $creds['channel_access_token'] ?? null;
            if (! $token) {
                return [
                    'ok' => false,
                    'provider' => 'line',
                    'mode' => 'stub',
                    'detail' => 'Missing channel_access_token',
                ];
            }

            try {
                $response = \Illuminate\Support\Facades\Http::withToken($token)
                    ->timeout(20)
                    ->post('https://api.line.me/v2/bot/message/push', [
                        'to' => $to,
                        'messages' => [['type' => 'text', 'text' => $body]],
                    ]);

                return [
                    'ok' => $response->successful(),
                    'provider' => 'line',
                    'mode' => 'live',
                    'detail' => $response->successful() ? 'Message sent' : $response->body(),
                ];
            } catch (\Throwable $e) {
                return ['ok' => false, 'provider' => 'line', 'mode' => 'live', 'detail' => $e->getMessage()];
            }
        }

        return [
            'ok' => false,
            'provider' => $connection->provider,
            'mode' => 'stub',
            'detail' => 'Unsupported provider',
        ];
    }

    /**
     * @return array{ok: bool, provider: string, mode: string, detail: string}
     */
    private function sendHttpWebhook(ChannelConnection $connection, string $to, string $body, string $provider): array
    {
        $creds = $connection->credentials ?? [];
        $url = $creds['outbound_url'] ?? null;
        if (! $url) {
            return [
                'ok' => true,
                'provider' => $provider,
                'mode' => 'queued',
                'detail' => 'No outbound_url — stored locally only',
            ];
        }

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(15)->post($url, [
                'to' => $to,
                'body' => $body,
                'provider' => $provider,
            ]);

            return [
                'ok' => $response->successful(),
                'provider' => $provider,
                'mode' => 'live',
                'detail' => $response->successful() ? 'Forwarded' : ('HTTP '.$response->status()),
            ];
        } catch (\Throwable $e) {
            return [
                'ok' => false,
                'provider' => $provider,
                'mode' => 'live',
                'detail' => $e->getMessage(),
            ];
        }
    }
}
