<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\AssignmentPolicy;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssignmentPolicyController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);

        $items = AssignmentPolicy::query()
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
            'strategy' => ['sometimes', 'string', 'in:round_robin,least_busy,manual'],
            'active' => ['sometimes', 'boolean'],
            'config' => ['nullable', 'array'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        abort_unless($accountId, 422, 'Account required');

        $policy = AssignmentPolicy::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'strategy' => $data['strategy'] ?? 'round_robin',
            'active' => $data['active'] ?? true,
            'config' => $data['config'] ?? null,
        ]);

        return response()->json(['data' => $policy], 201);
    }

    public function update(Request $request, AssignmentPolicy $assignmentPolicy): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $assignmentPolicy);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'strategy' => ['sometimes', 'string', 'in:round_robin,least_busy,manual'],
            'active' => ['sometimes', 'boolean'],
            'config' => ['nullable', 'array'],
        ]);

        $assignmentPolicy->update($data);

        return response()->json(['data' => $assignmentPolicy->fresh()]);
    }

    public function destroy(Request $request, AssignmentPolicy $assignmentPolicy): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $assignmentPolicy);
        $assignmentPolicy->delete();

        return response()->json(['ok' => true]);
    }
}
