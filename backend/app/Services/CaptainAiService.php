<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Conversation;
use App\Models\Message;

class CaptainAiService
{
    public function __construct(
        private OpenAiAssistService $openAi,
    ) {}

    /**
     * @return array{ok: bool, enabled: bool, suggestion?: string, mode: string, detail: string}
     */
    public function draft(Account $account, Conversation $conversation): array
    {
        $captain = $account->settings['captain'] ?? [];
        $enabled = (bool) ($captain['enabled'] ?? false);
        if (! $enabled) {
            // Fall back to OpenAI integration if Captain toggle is off but OpenAI is on
            $openai = $account->settings['integrations']['openai'] ?? [];
            if (empty($openai['enabled'])) {
                return [
                    'ok' => false,
                    'enabled' => false,
                    'mode' => 'stub',
                    'detail' => 'Captain AI disabled — enable in Settings → Captain or OpenAI integration',
                ];
            }
        }

        $result = $this->openAi->suggestReply($account, $conversation);

        return [
            'ok' => $result['ok'],
            'enabled' => true,
            'suggestion' => $result['suggestion'] ?? null,
            'mode' => $result['mode'],
            'detail' => $result['detail'],
        ];
    }

    /**
     * Optionally post a private Captain note with a draft when a customer message arrives.
     */
    public function maybeAssistOnInbound(Conversation $conversation, ?Message $message = null): void
    {
        $conversation->loadMissing('account');
        $account = $conversation->account;
        if (! $account) {
            return;
        }

        $captain = $account->settings['captain'] ?? [];
        if (empty($captain['enabled']) || empty($captain['auto_draft_on_inbound'])) {
            return;
        }

        $result = $this->draft($account, $conversation);
        if (! ($result['ok'] ?? false) || empty($result['suggestion'])) {
            return;
        }

        Message::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => null,
            'sender_type' => 'note',
            'private' => true,
            'body' => '[Captain AI draft] '.$result['suggestion'],
        ]);
    }
}
