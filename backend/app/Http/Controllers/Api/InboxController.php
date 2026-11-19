<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\Inbox;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class InboxController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $inboxes = Inbox::query()
            ->withCount('conversations')
            ->tap($this->accountScope($user))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $inboxes]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin() || $user->isSuperAdmin(), 403);
        abort_unless($user->account_id || $user->isSuperAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'channel' => ['nullable', 'string', 'max:32'],
            'account_id' => ['nullable', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        abort_unless($accountId, 422, 'account_id is required');

        $inbox = Inbox::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'channel' => $data['channel'] ?? 'website',
            'widget_token' => Str::random(40),
        ]);

        return response()->json(['data' => $inbox], 201);
    }

    public function rotateToken(Request $request, Inbox $inbox): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin() || $user->isSuperAdmin(), 403);
        $this->authorizeAccount($user, $inbox);

        $inbox->update(['widget_token' => Str::random(40)]);

        return response()->json(['data' => $inbox->fresh()]);
    }
}
