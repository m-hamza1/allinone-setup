<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\CustomAttributeDefinition;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CustomAttributeController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $items = CustomAttributeDefinition::query()
            ->tap($this->accountScope($user))
            ->orderBy('label')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);

        $data = $request->validate([
            'label' => ['required', 'string', 'max:80'],
            'key' => ['nullable', 'string', 'max:80'],
            'attribute_type' => ['sometimes', 'in:text,number,link,list'],
            'options' => ['nullable', 'array'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        $item = CustomAttributeDefinition::query()->create([
            'account_id' => $accountId,
            'label' => $data['label'],
            'key' => $data['key'] ?? Str::slug($data['label'], '_'),
            'attribute_type' => $data['attribute_type'] ?? 'text',
            'options' => $data['options'] ?? null,
        ]);

        return response()->json(['data' => $item], 201);
    }

    public function destroy(Request $request, CustomAttributeDefinition $customAttributeDefinition): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $customAttributeDefinition);
        $customAttributeDefinition->delete();

        return response()->json(['ok' => true]);
    }
}
