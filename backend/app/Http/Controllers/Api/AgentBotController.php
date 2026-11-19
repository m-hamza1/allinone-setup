<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\AgentBot;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentBotController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);

        $items = AgentBot::query()
            ->tap($this->accountScope($user))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'bot_type' => ['sometimes', 'string', 'in:webhook,csat,faq'],
            'outgoing_url' => ['nullable', 'string', 'max:500'],
            'active' => ['sometimes', 'boolean'],
            'config' => ['nullable', 'array'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        abort_unless($accountId, 422, 'Account required');

        $bot = AgentBot::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'bot_type' => $data['bot_type'] ?? 'webhook',
            'outgoing_url' => $data['outgoing_url'] ?? null,
            'active' => $data['active'] ?? true,
            'config' => $data['config'] ?? null,
        ]);

        return response()->json(['data' => $bot], 201);
    }

    public function update(Request $request, AgentBot $agentBot): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $agentBot);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'bot_type' => ['sometimes', 'string', 'in:webhook,csat,faq'],
            'outgoing_url' => ['nullable', 'string', 'max:500'],
            'active' => ['sometimes', 'boolean'],
            'config' => ['nullable', 'array'],
        ]);

        $agentBot->update($data);

        return response()->json(['data' => $agentBot->fresh()]);
    }

    public function destroy(Request $request, AgentBot $agentBot): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $agentBot);
        $agentBot->delete();

        return response()->json(['ok' => true]);
    }
}
