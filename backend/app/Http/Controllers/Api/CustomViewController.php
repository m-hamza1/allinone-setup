<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\CustomView;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomViewController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $views = CustomView::query()
            ->tap($this->accountScope($user))
            ->where(function ($q) use ($user) {
                $q->where('is_shared', true)->orWhere('user_id', $user->id);
            })
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $views]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->account_id || $user->isSuperAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'filters' => ['required', 'array'],
            'is_shared' => ['sometimes', 'boolean'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        $view = CustomView::query()->create([
            'account_id' => $accountId,
            'user_id' => $user->id,
            'name' => $data['name'],
            'filters' => $data['filters'],
            'is_shared' => $data['is_shared'] ?? false,
        ]);

        return response()->json(['data' => $view], 201);
    }

    public function update(Request $request, CustomView $customView): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $customView);
        abort_unless($customView->user_id === $user->id || $user->isAdmin(), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'filters' => ['sometimes', 'required', 'array'],
            'is_shared' => ['sometimes', 'boolean'],
        ]);

        $customView->update($data);

        return response()->json(['data' => $customView->fresh()]);
    }

    public function destroy(Request $request, CustomView $customView): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $customView);
        abort_unless($customView->user_id === $user->id || $user->isAdmin(), 403);
        $customView->delete();

        return response()->json(['ok' => true]);
    }
}
