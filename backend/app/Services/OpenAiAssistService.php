<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Conversation;
use Illuminate\Support\Facades\Http;

class OpenAiAssistService
{
    /**
     * @return array{ok: bool, suggestion?: string, mode: string, detail: string}
     */
    public function suggestReply(Account $account, Conversation $conversation): array
    {
        $stored = $account->settings['integrations']['openai'] ?? null;
        if (! is_array($stored) || empty($stored['enabled'])) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => 'OpenAI integration disabled'];
        }

        $apiKey = $stored['credentials']['api_key'] ?? null;
        if (! $apiKey) {
            return ['ok' => false, 'mode' => 'stub', 'detail' => 'Missing OpenAI api_key'];
        }

        $model = $stored['credentials']['model'] ?? 'gpt-4o-mini';
        $conversation->loadMissing(['messages' => fn ($q) => $q->orderByDesc('id')->limit(12), 'contact']);

        $history = $conversation->messages
            ->sortBy('id')
            ->map(function ($message) {
                $role = $message->sender_type === 'customer' ? 'Customer' : 'Agent';

                return "{$role}: {$message->body}";
            })
            ->implode("\n");

        $system = 'You are a helpful customer support agent. Draft a short, professional reply the human agent can send. Do not include greetings like "Sure!" unless natural. Keep under 120 words.';
        $userPrompt = "Contact: ".($conversation->contact?->name ?? 'Customer')."\n\nRecent messages:\n{$history}\n\nDraft the next agent reply:";

        try {
            $response = Http::withToken((string) $apiKey)
                ->timeout(25)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $model,
                    'temperature' => 0.4,
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                ]);
        } catch (\Throwable $e) {
            return ['ok' => false, 'mode' => 'live', 'detail' => $e->getMessage()];
        }

        if (! $response->successful()) {
            return [
                'ok' => false,
                'mode' => 'live',
                'detail' => $response->json('error.message') ?? $response->body(),
            ];
        }

        $suggestion = trim((string) ($response->json('choices.0.message.content') ?? ''));
        if ($suggestion === '') {
            return ['ok' => false, 'mode' => 'live', 'detail' => 'Empty suggestion'];
        }

        return [
            'ok' => true,
            'suggestion' => $suggestion,
            'mode' => 'live',
            'detail' => 'Suggestion ready',
        ];
    }
}
