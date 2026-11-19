<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Label;
use App\Models\Macro;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MacroController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $macros = Macro::query()
            ->tap($this->accountScope($user))
            ->where(function ($q) use ($user) {
                $q->where('visibility', 'account')->orWhere('user_id', $user->id);
            })
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $macros]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAdmin() || $user->role === 'staff', 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'visibility' => ['sometimes', 'in:account,personal'],
            'actions' => ['required', 'array', 'min:1'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $accountId = $user->isSuperAdmin()
            ? ($data['account_id'] ?? $user->account_id)
            : $user->account_id;

        $macro = Macro::query()->create([
            'account_id' => $accountId,
            'name' => $data['name'],
            'visibility' => $data['visibility'] ?? 'account',
            'user_id' => $user->id,
            'actions' => $data['actions'],
        ]);

        return response()->json(['data' => $macro], 201);
    }

    public function update(Request $request, Macro $macro): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $macro);
        abort_unless($user->isAdmin() || $macro->user_id === $user->id, 403);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'visibility' => ['sometimes', 'in:account,personal'],
            'actions' => ['sometimes', 'required', 'array', 'min:1'],
        ]);

        $macro->update($data);

        return response()->json(['data' => $macro->fresh()]);
    }

    public function destroy(Request $request, Macro $macro): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $macro);
        abort_unless($user->isAdmin() || $macro->user_id === $user->id, 403);
        $macro->delete();

        return response()->json(['ok' => true]);
    }

    public function apply(Request $request, Macro $macro, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $macro);
        $this->authorizeAccount($user, $conversation);

        foreach ($macro->actions as $action) {
            $type = $action['type'] ?? null;
            if ($type === 'assign' && ! empty($action['assignee_id'])) {
                $conversation->update(['assignee_id' => $action['assignee_id']]);
            }
            if ($type === 'status' && in_array($action['status'] ?? '', ['open', 'resolved'], true)) {
                $conversation->update(['status' => $action['status']]);
            }
            if ($type === 'add_label' && ! empty($action['label_id'])) {
                $label = Label::query()->find($action['label_id']);
                if ($label && $label->account_id === $conversation->account_id) {
                    $conversation->labels()->syncWithoutDetaching([$label->id]);
                }
            }
            if ($type === 'private_note' && ! empty($action['body'])) {
                Message::query()->create([
                    'conversation_id' => $conversation->id,
                    'user_id' => $user->id,
                    'sender_type' => 'note',
                    'private' => true,
                    'body' => $action['body'],
                ]);
            }
            if ($type === 'team' && array_key_exists('team_id', $action)) {
                $conversation->update(['team_id' => $action['team_id']]);
            }
        }

        $conversation->update(['last_activity_at' => now()]);

        return response()->json([
            'data' => $conversation->fresh([
                'assignee:id,name',
                'labels:id,title,color',
                'team:id,name',
                'messages' => fn ($q) => $q->orderBy('created_at'),
            ]),
        ]);
    }
}
