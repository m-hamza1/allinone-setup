<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\SlaPolicy;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SlaPolicyController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $items = SlaPolicy::query()
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
            'name' => ['required', 'string', 'max:80'],
            'first_response_minutes' => ['sometimes', 'integer', 'min:1'],
            'resolution_minutes' => ['sometimes', 'integer', 'min:1'],
            'only_during_business_hours' => ['sometimes', 'boolean'],
            'business_hours' => ['nullable', 'array'],
            'business_hours.start' => ['nullable', 'integer', 'min:0', 'max:23'],
            'business_hours.end' => ['nullable', 'integer', 'min:1', 'max:24'],
            'business_hours.days' => ['nullable', 'array'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        $policy = SlaPolicy::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'first_response_minutes' => $data['first_response_minutes'] ?? 15,
            'resolution_minutes' => $data['resolution_minutes'] ?? 1440,
            'only_during_business_hours' => $data['only_during_business_hours'] ?? false,
            'business_hours' => $data['business_hours'] ?? [
                'start' => 9,
                'end' => 17,
                'days' => [1, 2, 3, 4, 5],
            ],
        ]);

        return response()->json(['data' => $policy], 201);
    }

    public function destroy(Request $request, SlaPolicy $slaPolicy): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $slaPolicy);
        $slaPolicy->delete();

        return response()->json(['ok' => true]);
    }
}
