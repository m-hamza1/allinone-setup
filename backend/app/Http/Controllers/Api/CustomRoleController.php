<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\CustomRole;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomRoleController extends Controller
{
    use AuthorizesAccount;

    public function catalog(): JsonResponse
    {
        return response()->json(['data' => PermissionCatalog::definitions()]);
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin() || $user->canPermission('role_manage'), 403);

        $items = CustomRole::query()
            ->tap($this->accountScope($user))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'role_manage');
        abort_unless($user->isAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in(PermissionCatalog::keys())],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        abort_unless($accountId, 422, 'Account required');

        $role = CustomRole::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'permissions' => array_values(array_unique($data['permissions'] ?? [])),
        ]);

        return response()->json(['data' => $role], 201);
    }

    public function update(Request $request, CustomRole $customRole): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'role_manage');
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $customRole);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in(PermissionCatalog::keys())],
        ]);

        if (array_key_exists('permissions', $data)) {
            $data['permissions'] = array_values(array_unique($data['permissions'] ?? []));
        }

        $customRole->update($data);

        return response()->json(['data' => $customRole->fresh()]);
    }

    public function destroy(Request $request, CustomRole $customRole): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'role_manage');
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $customRole);
        $customRole->delete();

        return response()->json(['ok' => true]);
    }
}
