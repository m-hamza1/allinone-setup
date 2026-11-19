<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\ChannelConnection;
use App\Models\Inbox;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChannelConnectionController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $items = ChannelConnection::query()
            ->with('inbox:id,name,channel')
            ->tap($this->accountScope($user))
            ->orderBy('provider')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);

        $data = $request->validate([
            'provider' => ['required', 'in:email,whatsapp,instagram,facebook,sms,telegram,api,twitter,line'],
            'inbox_id' => ['nullable', 'integer', 'exists:inboxes,id'],
            'status' => ['sometimes', 'in:connected,disconnected,error'],
            'credentials' => ['nullable', 'array'],
            'meta' => ['nullable', 'array'],
            'create_inbox' => ['sometimes', 'boolean'],
            'inbox_name' => ['nullable', 'string', 'max:120'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;
        abort_unless($accountId, 422, 'Account required');

        $inboxId = $data['inbox_id'] ?? null;
        if (! empty($data['create_inbox'])) {
            $inbox = Inbox::query()->create([
                'account_id' => $accountId,
                'name' => $data['inbox_name'] ?? ucfirst($data['provider']).' inbox',
                'channel' => $data['provider'],
                'channel_config' => $data['meta'] ?? [],
            ]);
            $inboxId = $inbox->id;
        }

        $connection = ChannelConnection::query()->create([
            'account_id' => $accountId,
            'inbox_id' => $inboxId,
            'provider' => $data['provider'],
            'status' => $data['status'] ?? 'disconnected',
            'credentials' => $data['credentials'] ?? [],
            'meta' => $data['meta'] ?? [],
        ]);

        try {
            AuditLogger::log($user, 'channel.created', $connection);
        } catch (\Throwable) {
            // best-effort audit
        }

        return response()->json(['data' => $connection->load('inbox:id,name,channel')], 201);
    }

    public function update(Request $request, ChannelConnection $channelConnection): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $channelConnection);

        $data = $request->validate([
            'status' => ['sometimes', 'in:connected,disconnected,error'],
            'credentials' => ['nullable', 'array'],
            'meta' => ['nullable', 'array'],
            'inbox_id' => ['nullable', 'integer', 'exists:inboxes,id'],
        ]);

        $channelConnection->update($data);

        try {
            AuditLogger::log($user, 'channel.updated', $channelConnection);
        } catch (\Throwable) {
            // best-effort audit
        }

        return response()->json(['data' => $channelConnection->fresh()->load('inbox:id,name,channel')]);
    }

    public function destroy(Request $request, ChannelConnection $channelConnection): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $channelConnection);
        $channelConnection->delete();

        return response()->json(['ok' => true]);
    }
}
