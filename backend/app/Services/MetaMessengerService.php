<?php

namespace App\Services;

use App\Models\ChannelConnection;
use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Facebook Messenger + Instagram Messaging via Meta Graph API.
 */
class MetaMessengerService
{
    public function __construct(
        private SocialChannelAdapter $social,
    ) {}

    public function verifyWebhook(Request $request, int $accountId, string $provider = 'facebook'): mixed
    {
        $mode = (string) $request->query('hub_mode', $request->query('hub.mode'));
        $token = (string) $request->query('hub_verify_token', $request->query('hub.verify_token'));
        $challenge = $request->query('hub_challenge', $request->query('hub.challenge'));

        $connection = ChannelConnection::query()
            ->where('account_id', $accountId)
            ->whereIn('provider', ['facebook', 'instagram'])
            ->when(in_array($provider, ['facebook', 'instagram'], true), fn ($q) => $q->where('provider', $provider))
            ->orderByDesc('id')
            ->first();

        $verifyToken = $connection?->credentials['verify_token']
            ?? $connection?->meta['verify_token']
            ?? null;

        if ($mode === 'subscribe' && $verifyToken && hash_equals((string) $verifyToken, $token)) {
            return response((string) $challenge, 200)->header('Content-Type', 'text/plain');
        }

        // Dev-friendly fallback: accept challenge if any Meta connection exists with matching token
        if ($mode === 'subscribe' && $challenge && $verifyToken && hash_equals((string) $verifyToken, $token)) {
            return response((string) $challenge, 200)->header('Content-Type', 'text/plain');
        }

        if ($mode === 'subscribe' && $challenge && ! $verifyToken) {
            return response((string) $challenge, 200)->header('Content-Type', 'text/plain');
        }

        return response()->json(['error' => 'verification_failed'], 403);
    }

    /**
     * @return array{ok: bool, ingested: int, detail: string}
     */
    public function handleInbound(int $accountId, array $payload, ?string $forcedProvider = null): array
    {
        $ingested = 0;
        $entries = $payload['entry'] ?? [];

        foreach ($entries as $entry) {
            // Messenger classic
            foreach ($entry['messaging'] ?? [] as $event) {
                $from = $event['sender']['id'] ?? null;
                $text = $event['message']['text']
                    ?? ($event['message']['attachments'][0]['type'] ?? null ? '['.$event['message']['attachments'][0]['type'].']' : null)
                    ?? ($event['postback']['title'] ?? null);
                if (! $from || $text === null) {
                    continue;
                }

                $provider = $forcedProvider ?: $this->detectProvider($accountId, $entry);
                $this->social->ingest($provider, [
                    'account_id' => $accountId,
                    'from' => (string) $from,
                    'body' => (string) $text,
                ]);
                $ingested++;
            }

            // Instagram / Messenger standby + changes style
            foreach ($entry['changes'] ?? [] as $change) {
                $value = $change['value'] ?? [];
                $from = $value['sender']['id'] ?? $value['from']['id'] ?? null;
                $text = $value['message']['text'] ?? $value['text'] ?? null;
                if (! $from || $text === null) {
                    continue;
                }
                $provider = $forcedProvider ?: 'instagram';
                $this->social->ingest($provider, [
                    'account_id' => $accountId,
                    'from' => (string) $from,
                    'body' => (string) $text,
                ]);
                $ingested++;
            }
        }

        return [
            'ok' => true,
            'ingested' => $ingested,
            'detail' => $ingested > 0 ? "Ingested {$ingested} Meta message(s)" : 'No messages in payload',
        ];
    }

    /**
     * @return array{ok: bool, mode: string, detail: string}
     */
    public function sendReply(Conversation $conversation, string $body, string $provider): array
    {
        $conversation->loadMissing(['contact', 'inbox']);

        $connection = ChannelConnection::query()
            ->where('account_id', $conversation->account_id)
            ->where('provider', $provider)
            ->when(
                $conversation->inbox_id,
                fn ($q) => $q->where(fn ($inner) => $inner
                    ->where('inbox_id', $conversation->inbox_id)
                    ->orWhereNull('inbox_id')),
            )
            ->orderByDesc('id')
            ->first();

        if (! $connection) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => "No {$provider} channel connection"];
        }

        $attrKey = "{$provider}_id";
        $to = $conversation->contact?->custom_attributes[$attrKey] ?? null;
        if (! $to) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => "Contact missing {$attrKey}"];
        }

        return $this->sendMessage($connection, (string) $to, $body);
    }

    /**
     * @return array{ok: bool, mode: string, detail: string}
     */
    public function sendMessage(ChannelConnection $connection, string $to, string $body): array
    {
        $creds = $connection->credentials ?? [];
        $token = $creds['access_token'] ?? null;
        $pageId = $creds['page_id'] ?? null;
        $apiVersion = $creds['api_version'] ?? 'v19.0';

        if (! $token || ! $pageId) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => 'Missing access_token or page_id'];
        }

        $url = "https://graph.facebook.com/{$apiVersion}/{$pageId}/messages";

        try {
            $response = Http::withToken($token)
                ->timeout(20)
                ->post($url, [
                    'recipient' => ['id' => $to],
                    'messaging_type' => 'RESPONSE',
                    'message' => ['text' => $body],
                ]);
        } catch (\Throwable $e) {
            return ['ok' => false, 'mode' => 'live', 'detail' => $e->getMessage()];
        }

        if ($response->successful()) {
            $meta = $connection->meta ?? [];
            $meta['last_outbound_at'] = now()->toIso8601String();
            $meta['last_outbound_id'] = $response->json('message_id') ?? $response->json('id');
            $connection->update(['meta' => $meta, 'status' => 'connected']);

            return ['ok' => true, 'mode' => 'live', 'detail' => 'Message sent'];
        }

        Log::warning('meta.send_failed', [
            'provider' => $connection->provider,
            'status' => $response->status(),
            'body' => $response->json(),
        ]);

        return [
            'ok' => false,
            'mode' => 'live',
            'detail' => $response->json('error.message') ?? $response->body(),
        ];
    }

    private function detectProvider(int $accountId, array $entry): string
    {
        $object = $entry['id'] ?? null;
        if ($object) {
            $ig = ChannelConnection::query()
                ->where('account_id', $accountId)
                ->where('provider', 'instagram')
                ->where(fn ($q) => $q
                    ->where('credentials->page_id', (string) $object)
                    ->orWhere('meta->page_id', (string) $object))
                ->exists();
            if ($ig) {
                return 'instagram';
            }
        }

        return 'facebook';
    }
}
