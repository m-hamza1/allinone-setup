<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentTeamController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $teams = Team::query()
            ->with(['members:id,name,email,role'])
            ->withCount('members')
            ->tap($this->accountScope($user))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $teams]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'allow_auto_assign' => ['sometimes', 'boolean'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'exists:users,id'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;
        abort_unless($accountId, 422, 'Account required');

        $team = Team::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'allow_auto_assign' => $data['allow_auto_assign'] ?? true,
        ]);

        if (! empty($data['member_ids'])) {
            $team->members()->sync($data['member_ids']);
        }

        return response()->json(['data' => $team->load('members:id,name,email,role')], 201);
    }

    public function update(Request $request, Team $team): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $team);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'allow_auto_assign' => ['sometimes', 'boolean'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $team->update(collect($data)->except('member_ids')->all());
        if (array_key_exists('member_ids', $data)) {
            $team->members()->sync($data['member_ids']);
        }

        return response()->json(['data' => $team->fresh()->load('members:id,name,email,role')]);
    }

    public function destroy(Request $request, Team $team): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $team);
        $team->delete();

        return response()->json(['ok' => true]);
    }
}
