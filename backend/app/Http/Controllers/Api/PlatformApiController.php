<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\PlatformApiToken;
use App\Models\User;
use App\Services\SocialChannelAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformApiController extends Controller
{
    public function indexTokens(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);

        $tokens = PlatformApiToken::query()
            ->where('account_id', $user->account_id)
            ->orderByDesc('id')
            ->get(['id', 'name', 'token_prefix', 'abilities', 'last_used_at', 'created_at']);

        return response()->json(['data' => $tokens]);
    }

    public function createToken(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        $account = Account::query()->findOrFail($user->account_id);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
        ]);

        $issued = PlatformApiToken::issue($account, $user, $data['name']);

        return response()->json([
            'data' => [
                'id' => $issued['model']->id,
                'name' => $issued['model']->name,
                'token' => $issued['token'],
                'token_prefix' => $issued['model']->token_prefix,
            ],
        ], 201);
    }

    public function destroyToken(Request $request, PlatformApiToken $platformApiToken): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin(), 403);
        abort_unless($platformApiToken->account_id === $user->account_id, 403);
        $platformApiToken->delete();

        return response()->json(['ok' => true]);
    }

    public function contacts(Request $request): JsonResponse
    {
        $accountId = (int) $request->attributes->get('platform_account_id');
        $contacts = Contact::query()
            ->where('account_id', $accountId)
            ->orderByDesc('id')
            ->limit(100)
            ->get(['id', 'name', 'email', 'phone', 'custom_attributes', 'created_at']);

        return response()->json(['data' => $contacts]);
    }

    public function conversations(Request $request): JsonResponse
    {
        $accountId = (int) $request->attributes->get('platform_account_id');
        $items = Conversation::query()
            ->where('account_id', $accountId)
            ->with(['contact:id,name,email', 'inbox:id,name,channel'])
            ->orderByDesc('last_activity_at')
            ->limit(100)
            ->get(['id', 'status', 'inbox_id', 'contact_id', 'assignee_id', 'last_activity_at']);

        return response()->json(['data' => $items]);
    }

    public function createContact(Request $request): JsonResponse
    {
        $accountId = (int) $request->attributes->get('platform_account_id');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'custom_attributes' => ['nullable', 'array'],
        ]);

        $contact = Contact::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'custom_attributes' => $data['custom_attributes'] ?? [],
        ]);

        return response()->json(['data' => $contact], 201);
    }

    public function ingest(Request $request, SocialChannelAdapter $social): JsonResponse
    {
        $accountId = (int) $request->attributes->get('platform_account_id');
        $data = $request->validate([
            'provider' => ['sometimes', 'in:api,telegram,whatsapp,sms,twitter,line'],
            'from' => ['required', 'string', 'max:190'],
            'from_name' => ['nullable', 'string', 'max:120'],
            'body' => ['required', 'string'],
        ]);

        $conversation = $social->ingest($data['provider'] ?? 'api', [
            'account_id' => $accountId,
            'from' => $data['from'],
            'from_name' => $data['from_name'] ?? $data['from'],
            'body' => $data['body'],
        ]);

        return response()->json(['data' => ['conversation_id' => $conversation->id]], 201);
    }
}
