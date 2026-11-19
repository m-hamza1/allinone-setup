<?php

namespace App\Services;

use App\Models\Account;
use App\Models\AgentBot;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class IntegrationDispatcher
{
    /**
     * Fire enabled account integrations for a conversation event.
     */
    public function dispatch(string $event, Conversation $conversation, ?Message $message = null): void
    {
        $conversation->loadMissing(['account', 'contact', 'inbox', 'assignee']);
        $account = $conversation->account;
        if (! $account) {
            return;
        }

        $integrations = $account->settings['integrations'] ?? [];
        if (! is_array($integrations) || $integrations === []) {
            $this->notifyAgentBots($event, $conversation, $message);

            return;
        }

        $payload = $this->payload($event, $conversation, $message);

        if ($this->isEnabled($integrations, 'webhooks')) {
            $this->sendWebhook($integrations['webhooks']['credentials'] ?? [], $payload);
        }

        if ($this->isEnabled($integrations, 'slack') && in_array($event, [
            'conversation_created',
            'message_created',
            'conversation_assigned',
        ], true)) {
            $this->sendSlack($integrations['slack']['credentials'] ?? [], $payload);
        }

        if ($this->isEnabled($integrations, 'dialogflow') && $event === 'message_created' && $message?->sender_type === 'customer') {
            $this->sendDialogflowHook($integrations['dialogflow']['credentials'] ?? [], $payload);
        }

        $this->notifyAgentBots($event, $conversation, $message);
    }

    /**
     * Smoke-test an integration without a real conversation.
     *
     * @return array{ok: bool, mode: string, detail: string}
     */
    public function test(Account $account, string $key): array
    {
        $stored = $account->settings['integrations'][$key] ?? null;
        if (! is_array($stored) || empty($stored['enabled'])) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => 'Integration disabled'];
        }

        $credentials = is_array($stored['credentials'] ?? null) ? $stored['credentials'] : [];
        $payload = [
            'event' => 'integration.test',
            'account_id' => $account->id,
            'tested_at' => now()->toIso8601String(),
            'source' => 'allin',
        ];

        return match ($key) {
            'webhooks' => $this->sendWebhook($credentials, $payload, returnResult: true),
            'slack' => $this->sendSlack($credentials, $payload, returnResult: true),
            'dialogflow' => $this->sendDialogflowHook($credentials, $payload, returnResult: true),
            default => [
                'ok' => true,
                'mode' => 'configured',
                'detail' => 'Credentials stored — runtime hooks fire on conversation events.',
            ],
        };
    }

    private function isEnabled(array $integrations, string $key): bool
    {
        return ! empty($integrations[$key]['enabled']);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(string $event, Conversation $conversation, ?Message $message): array
    {
        return [
            'event' => $event,
            'account_id' => $conversation->account_id,
            'conversation' => [
                'id' => $conversation->id,
                'status' => $conversation->status,
                'inbox_id' => $conversation->inbox_id,
                'assignee_id' => $conversation->assignee_id,
                'contact' => [
                    'id' => $conversation->contact?->id,
                    'name' => $conversation->contact?->name,
                    'email' => $conversation->contact?->email,
                    'phone' => $conversation->contact?->phone,
                ],
            ],
            'message' => $message ? [
                'id' => $message->id,
                'body' => $message->body,
                'sender_type' => $message->sender_type,
                'private' => (bool) $message->private,
            ] : null,
            'occurred_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $credentials
     * @param  array<string, mixed>  $payload
     * @return array{ok: bool, mode: string, detail: string}|null
     */
    private function sendWebhook(array $credentials, array $payload, bool $returnResult = false): ?array
    {
        $url = $credentials['url'] ?? null;
        if (! $url) {
            return $returnResult
                ? ['ok' => false, 'mode' => 'stub', 'detail' => 'Missing webhook URL']
                : null;
        }

        $secret = $credentials['secret'] ?? null;
        $body = json_encode($payload, JSON_THROW_ON_ERROR);
        $headers = ['Content-Type' => 'application/json', 'X-Allin-Event' => (string) ($payload['event'] ?? 'event')];
        if ($secret) {
            $headers['X-Allin-Signature'] = 'sha256='.hash_hmac('sha256', $body, (string) $secret);
        }

        try {
            $response = Http::withHeaders($headers)->timeout(12)->withBody($body, 'application/json')->post($url);
            $ok = $response->successful();
            $detail = $ok ? 'Webhook delivered' : ('HTTP '.$response->status().': '.$response->body());

            if ($returnResult) {
                return ['ok' => $ok, 'mode' => 'live', 'detail' => $detail];
            }

            if (! $ok) {
                Log::warning('integration.webhook_failed', ['url' => $url, 'status' => $response->status()]);
            }
        } catch (\Throwable $e) {
            Log::warning('integration.webhook_error', ['url' => $url, 'error' => $e->getMessage()]);
            if ($returnResult) {
                return ['ok' => false, 'mode' => 'live', 'detail' => $e->getMessage()];
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $credentials
     * @param  array<string, mixed>  $payload
     * @return array{ok: bool, mode: string, detail: string}|null
     */
    private function sendSlack(array $credentials, array $payload, bool $returnResult = false): ?array
    {
        $url = $credentials['webhook_url'] ?? null;
        if (! $url) {
            return $returnResult
                ? ['ok' => false, 'mode' => 'stub', 'detail' => 'Missing Slack webhook URL']
                : null;
        }

        $contact = $payload['conversation']['contact']['name'] ?? 'Contact';
        $event = $payload['event'] ?? 'event';
        $bodyPreview = $payload['message']['body'] ?? ($payload['conversation']['status'] ?? '');
        $channel = $credentials['channel'] ?? null;

        $text = "*Allin* · `{$event}` · {$contact}\n{$bodyPreview}";
        $slackPayload = ['text' => $text];
        if ($channel) {
            $slackPayload['channel'] = $channel;
        }

        try {
            $response = Http::timeout(12)->post($url, $slackPayload);
            $ok = $response->successful();
            $detail = $ok ? 'Slack notified' : ('HTTP '.$response->status().': '.$response->body());

            if ($returnResult) {
                return ['ok' => $ok, 'mode' => 'live', 'detail' => $detail];
            }
        } catch (\Throwable $e) {
            Log::warning('integration.slack_error', ['error' => $e->getMessage()]);
            if ($returnResult) {
                return ['ok' => false, 'mode' => 'live', 'detail' => $e->getMessage()];
            }
        }

        return null;
    }

    /**
     * Lightweight Dialogflow-style hook: POST detect payload to a configured proxy if
     * credentials_json contains webhook_url; otherwise acknowledge configuration.
     *
     * @param  array<string, mixed>  $credentials
     * @param  array<string, mixed>  $payload
     * @return array{ok: bool, mode: string, detail: string}|null
     */
    private function sendDialogflowHook(array $credentials, array $payload, bool $returnResult = false): ?array
    {
        $projectId = $credentials['project_id'] ?? null;
        if (! $projectId) {
            return $returnResult
                ? ['ok' => false, 'mode' => 'stub', 'detail' => 'Missing Dialogflow project_id']
                : null;
        }

        // Optional override: credentials_json may be a URL or JSON with webhook_url for CX webhook proxy.
        $proxyUrl = null;
        $raw = $credentials['credentials_json'] ?? null;
        if (is_string($raw) && str_starts_with(trim($raw), 'http')) {
            $proxyUrl = trim($raw);
        } elseif (is_string($raw) && str_starts_with(trim($raw), '{')) {
            try {
                $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
                $proxyUrl = $decoded['webhook_url'] ?? null;
            } catch (\Throwable) {
                $proxyUrl = null;
            }
        }

        if (! $proxyUrl) {
            return $returnResult
                ? [
                    'ok' => true,
                    'mode' => 'configured',
                    'detail' => 'Dialogflow project stored. Add webhook_url in credentials JSON to forward intents.',
                ]
                : null;
        }

        try {
            $response = Http::timeout(12)->post($proxyUrl, [
                ...$payload,
                'project_id' => $projectId,
                'language_code' => $credentials['language_code'] ?? 'en',
            ]);
            $ok = $response->successful();
            $detail = $ok ? 'Dialogflow proxy notified' : ('HTTP '.$response->status());

            if ($returnResult) {
                return ['ok' => $ok, 'mode' => 'live', 'detail' => $detail];
            }
        } catch (\Throwable $e) {
            if ($returnResult) {
                return ['ok' => false, 'mode' => 'live', 'detail' => $e->getMessage()];
            }
        }

        return null;
    }

    private function notifyAgentBots(string $event, Conversation $conversation, ?Message $message): void
    {
        if (! in_array($event, ['conversation_created', 'message_created'], true)) {
            return;
        }

        $bots = AgentBot::query()
            ->where('account_id', $conversation->account_id)
            ->where('active', true)
            ->whereNotNull('outgoing_url')
            ->get();

        if ($bots->isEmpty()) {
            return;
        }

        $body = [
            'event' => $event,
            'conversation_id' => $conversation->id,
            'account_id' => $conversation->account_id,
            'message' => $message?->only(['id', 'body', 'sender_type', 'private']),
        ];

        foreach ($bots as $bot) {
            try {
                Http::timeout(8)->post((string) $bot->outgoing_url, [
                    ...$body,
                    'bot_id' => $bot->id,
                    'bot_name' => $bot->name,
                ]);
            } catch (\Throwable $e) {
                Log::debug('agent_bot.webhook_error', ['bot_id' => $bot->id, 'error' => $e->getMessage()]);
            }
        }
    }
}
