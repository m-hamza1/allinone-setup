<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomRole;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class TeamController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $team = User::query()
            ->with('customRole:id,name,permissions')
            ->select(['id', 'name', 'email', 'role', 'account_id', 'custom_role_id', 'created_at'])
            ->when(
                $user->account_id && ! $user->isSuperAdmin(),
                fn ($q) => $q->where('account_id', $user->account_id),
            )
            ->when(
                $user->isSuperAdmin() && $request->query('account_id'),
                fn ($q) => $q->where('account_id', $request->query('account_id')),
            )
            ->whereIn('role', ['admin', 'staff', 'super_admin'])
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $team]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        abort_unless($actor->isAdmin() || $actor->canPermission('team_manage'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', Rule::in(['admin', 'staff'])],
            'custom_role_id' => ['nullable', 'integer', 'exists:custom_roles,id'],
        ]);

        abort_unless($actor->account_id || $actor->isSuperAdmin(), 422, 'Account required');

        $customRoleId = $this->resolveCustomRoleId($actor, $data['custom_role_id'] ?? null);

        $member = User::query()->create([
            'account_id' => $actor->account_id,
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'custom_role_id' => $data['role'] === 'staff' ? $customRoleId : null,
        ]);

        try {
            AuditLogger::log($actor, 'team.member_created', $member);
        } catch (\Throwable) {
            // best-effort audit
        }

        $member->load('customRole:id,name,permissions');

        return response()->json([
            'data' => $member->only(['id', 'name', 'email', 'role', 'account_id', 'custom_role_id', 'created_at'])
                + ['custom_role' => $member->customRole],
        ], 201);
    }

    public function update(Request $request, User $member): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        abort_unless($actor->isAdmin() || $actor->canPermission('team_manage'), 403);

        if (! $actor->isSuperAdmin()) {
            abort_unless($actor->account_id && $member->account_id === $actor->account_id, 403);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'role' => ['sometimes', 'required', Rule::in(['admin', 'staff'])],
            'custom_role_id' => ['nullable', 'integer', 'exists:custom_roles,id'],
            'password' => ['nullable', 'string', 'min:6'],
        ]);

        if (array_key_exists('custom_role_id', $data)) {
            $data['custom_role_id'] = $this->resolveCustomRoleId($actor, $data['custom_role_id']);
        }

        if (($data['role'] ?? $member->role) !== 'staff') {
            $data['custom_role_id'] = null;
        }

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $member->update($data);
        $member->load('customRole:id,name,permissions');

        try {
            AuditLogger::log($actor, 'team.member_updated', $member);
        } catch (\Throwable) {
            // best-effort
        }

        return response()->json([
            'data' => $member->only(['id', 'name', 'email', 'role', 'account_id', 'custom_role_id', 'created_at'])
                + ['custom_role' => $member->customRole],
        ]);
    }

    private function resolveCustomRoleId(User $actor, ?int $customRoleId): ?int
    {
        if (! $customRoleId) {
            return null;
        }

        $role = CustomRole::query()->findOrFail($customRoleId);
        if (! $actor->isSuperAdmin()) {
            abort_unless($role->account_id === $actor->account_id, 403);
        }

        return $role->id;
    }
}
