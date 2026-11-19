<?php

namespace App\Services;

use App\Models\ChannelConnection;
use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppCloudService
{
    public function __construct(
        private SocialChannelAdapter $social,
    ) {}

    /**
     * Meta webhook verification (GET).
     */
    public function verifyWebhook(Request $request, int $accountId): mixed
    {
        $mode = (string) $request->query('hub_mode', $request->query('hub.mode'));
        $token = (string) $request->query('hub_verify_token', $request->query('hub.verify_token'));
        $challenge = $request->query('hub_challenge', $request->query('hub.challenge'));

        $connection = ChannelConnection::query()
            ->where('account_id', $accountId)
            ->where('provider', 'whatsapp')
            ->orderByDesc('id')
            ->first();

        $verifyToken = $connection?->credentials['verify_token']
            ?? $connection?->meta['verify_token']
            ?? null;

        if ($mode === 'subscribe' && $verifyToken && hash_equals((string) $verifyToken, $token)) {
            return response((string) $challenge, 200)->header('Content-Type', 'text/plain');
        }

        return response()->json(['error' => 'verification_failed'], 403);
    }

    /**
     * @return array{ok: bool, ingested?: int, detail: string}
     */
    public function handleInbound(int $accountId, array $payload): array
    {
        $entries = $payload['entry'] ?? [];
        $ingested = 0;

        foreach ($entries as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                $value = $change['value'] ?? [];
                foreach ($value['messages'] ?? [] as $message) {
                    $from = $message['from'] ?? null;
                    $body = $this->extractInboundBody($message);
                    if (! $from) {
                        continue;
                    }

                    $this->social->ingest('whatsapp', [
                        'account_id' => $accountId,
                        'from' => $from,
                        'from_name' => $value['contacts'][0]['profile']['name'] ?? $from,
                        'body' => $body,
                        'external_id' => $message['id'] ?? null,
                    ]);
                    $ingested++;
                }

                // Status callbacks (delivered/read) — acknowledge without creating messages
                if (! empty($value['statuses']) && empty($value['messages'])) {
                    Log::debug('whatsapp.status', ['account_id' => $accountId, 'statuses' => count($value['statuses'])]);
                }
            }
        }

        return [
            'ok' => true,
            'ingested' => $ingested,
            'detail' => $ingested > 0 ? "Ingested {$ingested} message(s)" : 'No messages in payload',
        ];
    }

    /**
     * Staff reply on a WhatsApp conversation.
     *
     * @return array{ok: bool, mode: string, detail: string}
     */
    public function sendReply(Conversation $conversation, string $body): array
    {
        $conversation->loadMissing(['contact', 'inbox']);

        $connection = ChannelConnection::query()
            ->where('account_id', $conversation->account_id)
            ->where('provider', 'whatsapp')
            ->when(
                $conversation->inbox_id,
                fn ($q) => $q->where(fn ($inner) => $inner
                    ->where('inbox_id', $conversation->inbox_id)
                    ->orWhereNull('inbox_id')),
            )
            ->orderByDesc('id')
            ->first();

        if (! $connection) {
            return [
                'ok' => false,
                'mode' => 'stub',
                'detail' => 'No WhatsApp channel connection for this account',
            ];
        }

        $to = $conversation->contact?->phone
            ?? ($conversation->contact?->custom_attributes['whatsapp_id'] ?? null);

        if (! $to) {
            return [
                'ok' => false,
                'mode' => 'stub',
                'detail' => 'Contact has no WhatsApp phone / whatsapp_id',
            ];
        }

        // Graph API expects digits only (country code, no +)
        $to = preg_replace('/\D+/', '', (string) $to) ?: (string) $to;

        return $this->sendMessage($connection, $to, $body);
    }

    /**
     * @return array{ok: bool, mode: string, detail: string}
     */
    public function sendMessage(ChannelConnection $connection, string $to, string $body): array
    {
        $creds = $connection->credentials ?? [];
        $token = $creds['access_token'] ?? null;
        $phoneNumberId = $creds['phone_number_id'] ?? null;
        $apiVersion = $creds['api_version'] ?? 'v19.0';

        if (! $token || ! $phoneNumberId) {
            return [
                'ok' => false,
                'mode' => 'stub',
                'detail' => 'Missing access_token or phone_number_id',
            ];
        }

        $url = "https://graph.facebook.com/{$apiVersion}/{$phoneNumberId}/messages";

        try {
            $response = Http::withToken($token)
                ->timeout(20)
                ->post($url, [
                    'messaging_product' => 'whatsapp',
                    'recipient_type' => 'individual',
                    'to' => $to,
                    'type' => 'text',
                    'text' => [
                        'preview_url' => false,
                        'body' => $body,
                    ],
                ]);
        } catch (\Throwable $e) {
            return [
                'ok' => false,
                'mode' => 'live',
                'detail' => $e->getMessage(),
            ];
        }

        if ($response->successful()) {
            $meta = $connection->meta ?? [];
            $meta['last_outbound_at'] = now()->toIso8601String();
            $meta['last_outbound_id'] = $response->json('messages.0.id');
            $connection->update(['meta' => $meta, 'status' => 'connected']);

            return [
                'ok' => true,
                'mode' => 'live',
                'detail' => 'Message sent',
            ];
        }

        return [
            'ok' => false,
            'mode' => 'live',
            'detail' => $response->json('error.message') ?? $response->body(),
        ];
    }

    /**
     * @param  array<string, mixed>  $message
     */
    private function extractInboundBody(array $message): string
    {
        if (isset($message['text']['body'])) {
            return (string) $message['text']['body'];
        }
        if (isset($message['button']['text'])) {
            return (string) $message['button']['text'];
        }
        if (isset($message['interactive']['button_reply']['title'])) {
            return (string) $message['interactive']['button_reply']['title'];
        }
        if (isset($message['interactive']['list_reply']['title'])) {
            return (string) $message['interactive']['list_reply']['title'];
        }
        if (($message['type'] ?? null) === 'image') {
            return '[image] '.($message['image']['caption'] ?? '');
        }
        if (($message['type'] ?? null) === 'audio') {
            return '[audio]';
        }
        if (($message['type'] ?? null) === 'document') {
            return '[document] '.($message['document']['filename'] ?? '');
        }

        return '(unsupported WhatsApp message type: '.($message['type'] ?? 'unknown').')';
    }
}
