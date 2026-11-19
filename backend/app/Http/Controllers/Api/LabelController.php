<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\Label;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LabelController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $labels = Label::query()
            ->tap($this->accountScope($user))
            ->orderBy('title')
            ->get();

        return response()->json(['data' => $labels]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'label_manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:80'],
            'color' => ['nullable', 'string', 'max:32'],
            'description' => ['nullable', 'string', 'max:255'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        abort_unless($accountId, 422, 'Account required');

        $label = Label::query()->create([
            'account_id' => $accountId,
            'title' => $data['title'],
            'color' => $data['color'] ?? '#0f6e56',
            'description' => $data['description'] ?? null,
        ]);

        return response()->json(['data' => $label], 201);
    }

    public function update(Request $request, Label $label): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'super_admin'], true), 403);
        $this->authorizeAccount($user, $label);

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:80'],
            'color' => ['nullable', 'string', 'max:32'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $label->update($data);

        return response()->json(['data' => $label->fresh()]);
    }

    public function destroy(Request $request, Label $label): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'super_admin'], true), 403);
        $this->authorizeAccount($user, $label);

        $label->delete();

        return response()->json(['ok' => true]);
    }
}
