<?php

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('account.{accountId}', function (User $user, int $accountId) {
    return $user->isSuperAdmin() || (int) $user->account_id === $accountId;
});

Broadcast::channel('conversation.{conversationId}', function (User $user, int $conversationId) {
    if ($user->isSuperAdmin()) {
        return true;
    }

    $conversation = Conversation::query()->find($conversationId);
    if (! $conversation) {
        return false;
    }

    return (int) $user->account_id === (int) $conversation->account_id;
});
