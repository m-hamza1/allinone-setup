<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\CannedResponse;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CannedResponseController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $items = CannedResponse::query()
            ->tap($this->accountScope($user))
            ->orderBy('short_code')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'super_admin', 'staff'], true), 403);

        $data = $request->validate([
            'short_code' => ['required', 'string', 'max:40'],
            'content' => ['required', 'string', 'max:5000'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        abort_unless($accountId, 422, 'Account required');

        $item = CannedResponse::query()->create([
            'account_id' => $accountId,
            'short_code' => Str::slug($data['short_code'], '_'),
            'content' => $data['content'],
        ]);

        return response()->json(['data' => $item], 201);
    }

    public function update(Request $request, CannedResponse $cannedResponse): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'super_admin'], true) || $user->role === 'staff', 403);
        $this->authorizeAccount($user, $cannedResponse);

        $data = $request->validate([
            'short_code' => ['sometimes', 'required', 'string', 'max:40'],
            'content' => ['sometimes', 'required', 'string', 'max:5000'],
        ]);

        if (isset($data['short_code'])) {
            $data['short_code'] = Str::slug($data['short_code'], '_');
        }

        $cannedResponse->update($data);

        return response()->json(['data' => $cannedResponse->fresh()]);
    }

    public function destroy(Request $request, CannedResponse $cannedResponse): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'super_admin'], true), 403);
        $this->authorizeAccount($user, $cannedResponse);

        $cannedResponse->delete();

        return response()->json(['ok' => true]);
    }
}
