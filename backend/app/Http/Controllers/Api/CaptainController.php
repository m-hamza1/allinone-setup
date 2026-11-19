<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Conversation;
use App\Models\User;
use App\Services\CaptainAiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CaptainController extends Controller
{
    use AuthorizesAccount;

    public function settings(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $account = Account::query()->findOrFail($user->account_id);
        $captain = $account->settings['captain'] ?? [
            'enabled' => false,
            'auto_draft_on_inbound' => false,
        ];

        return response()->json(['data' => $captain]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $account = Account::query()->findOrFail($user->account_id);

        $data = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'auto_draft_on_inbound' => ['sometimes', 'boolean'],
        ]);

        $settings = $account->settings ?? [];
        $settings['captain'] = array_merge($settings['captain'] ?? [], $data);
        $account->update(['settings' => $settings]);

        return response()->json(['data' => $settings['captain']]);
    }

    public function draft(Request $request, Conversation $conversation, CaptainAiService $captain): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'conversation_manage');
        $this->authorizeAccount($user, $conversation);

        $account = Account::query()->findOrFail($conversation->account_id);

        return response()->json(['data' => $captain->draft($account, $conversation)]);
    }
}
