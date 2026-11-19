<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\MessageTemplate;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageTemplateController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);

        $items = MessageTemplate::query()
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
            'channel' => ['sometimes', 'string', 'max:32'],
            'language' => ['sometimes', 'string', 'max:12'],
            'body' => ['required', 'string'],
            'status' => ['sometimes', 'string', 'in:draft,approved,rejected'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        abort_unless($accountId, 422, 'Account required');

        $template = MessageTemplate::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'channel' => $data['channel'] ?? 'whatsapp',
            'language' => $data['language'] ?? 'en',
            'body' => $data['body'],
            'status' => $data['status'] ?? 'draft',
        ]);

        return response()->json(['data' => $template], 201);
    }

    public function update(Request $request, MessageTemplate $messageTemplate): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $messageTemplate);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'channel' => ['sometimes', 'string', 'max:32'],
            'language' => ['sometimes', 'string', 'max:12'],
            'body' => ['sometimes', 'required', 'string'],
            'status' => ['sometimes', 'string', 'in:draft,approved,rejected'],
        ]);

        $messageTemplate->update($data);

        return response()->json(['data' => $messageTemplate->fresh()]);
    }

    public function destroy(Request $request, MessageTemplate $messageTemplate): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $this->authorizeAccount($user, $messageTemplate);
        $messageTemplate->delete();

        return response()->json(['ok' => true]);
    }
}
