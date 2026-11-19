<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Inbox;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin() || $user->isSuperAdmin(), 403);

        $accountId = $user->account_id;

        $conversations = Conversation::query()
            ->when($accountId, fn ($q) => $q->where('account_id', $accountId));

        return response()->json([
            'data' => [
                'open_conversations' => (clone $conversations)->where('status', 'open')->count(),
                'resolved_conversations' => (clone $conversations)->where('status', 'resolved')->count(),
                'unassigned_open' => (clone $conversations)->where('status', 'open')->whereNull('assignee_id')->count(),
                'contacts' => Contact::query()->when($accountId, fn ($q) => $q->where('account_id', $accountId))->count(),
                'inboxes' => Inbox::query()->when($accountId, fn ($q) => $q->where('account_id', $accountId))->count(),
                'staff' => User::query()
                    ->when($accountId, fn ($q) => $q->where('account_id', $accountId))
                    ->whereIn('role', ['admin', 'staff'])
                    ->count(),
            ],
        ]);
    }
}
