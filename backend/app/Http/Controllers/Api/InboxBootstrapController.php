<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\CannedResponse;
use App\Models\Conversation;
use App\Models\CustomView;
use App\Models\Label;
use App\Models\Macro;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Industry-style workspace bootstrap: one round-trip for inbox shell data.
 * Chatwoot/Intercom pattern — avoid Promise.all storms of 5–6 meta endpoints.
 */
class InboxBootstrapController extends Controller
{
    use AuthorizesAccount;

    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $scope = $this->accountScope($user);

        $conversations = Conversation::query()
            ->with([
                'contact:id,name,email',
                'assignee:id,name',
                'inbox:id,name',
                'labels:id,title,color',
            ])
            ->tap($scope)
            ->when($request->query('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->when($request->query('assignee') === 'me', fn ($q) => $q->where('assignee_id', $user->id))
            ->when($request->query('assignee') === 'unassigned', fn ($q) => $q->whereNull('assignee_id'))
            ->when($request->query('label_id'), function ($q) use ($request) {
                $q->whereHas('labels', fn ($labels) => $labels->where('labels.id', $request->query('label_id')));
            })
            ->when($request->query('search'), function ($q) use ($request) {
                $term = '%'.$request->query('search').'%';
                $q->whereHas('contact', function ($contact) use ($term) {
                    $contact->where('name', 'ilike', $term)->orWhere('email', 'ilike', $term);
                });
            })
            ->orderByDesc('last_activity_at')
            ->limit(30)
            ->get();

        $ids = $conversations->pluck('id');
        $latestByConversation = collect();
        if ($ids->isNotEmpty()) {
            $latestIds = Message::query()
                ->selectRaw('MAX(id) as id')
                ->whereIn('conversation_id', $ids)
                ->where('private', false)
                ->where('sender_type', '!=', 'note')
                ->groupBy('conversation_id')
                ->pluck('id');

            $latestByConversation = Message::query()
                ->whereIn('id', $latestIds)
                ->get(['id', 'conversation_id', 'body', 'sender_type', 'private', 'created_at'])
                ->keyBy('conversation_id');
        }

        $conversations->transform(function (Conversation $conversation) use ($latestByConversation) {
            $conversation->setAttribute('latest_message', $latestByConversation->get($conversation->id));

            return $conversation;
        });

        return response()->json([
            'data' => [
                'conversations' => $conversations,
                'team' => User::query()
                    ->when(
                        $user->account_id && ! $user->isSuperAdmin(),
                        fn ($q) => $q->where('account_id', $user->account_id),
                    )
                    ->whereIn('role', ['admin', 'staff', 'super_admin'])
                    ->orderBy('name')
                    ->get(['id', 'name', 'email', 'role', 'account_id']),
                'labels' => Label::query()->tap($scope)->orderBy('title')->get(['id', 'title', 'color', 'description']),
                'canned' => CannedResponse::query()->tap($scope)->orderBy('short_code')->get(),
                'macros' => Macro::query()->tap($scope)->orderBy('name')->get(),
                'views' => CustomView::query()
                    ->tap($scope)
                    ->where(function ($q) use ($user) {
                        $q->where('is_shared', true)->orWhere('user_id', $user->id);
                    })
                    ->orderBy('name')
                    ->get(),
            ],
        ]);
    }

    /**
     * Single fallback poll when websockets are down — list + optional message delta.
     */
    public function sync(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $scope = $this->accountScope($user);

        $conversations = Conversation::query()
            ->with([
                'contact:id,name,email',
                'assignee:id,name',
                'inbox:id,name',
                'labels:id,title,color',
            ])
            ->tap($scope)
            ->when($request->query('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->when($request->query('assignee') === 'me', fn ($q) => $q->where('assignee_id', $user->id))
            ->when($request->query('assignee') === 'unassigned', fn ($q) => $q->whereNull('assignee_id'))
            ->when($request->query('label_id'), function ($q) use ($request) {
                $q->whereHas('labels', fn ($labels) => $labels->where('labels.id', $request->query('label_id')));
            })
            ->when($request->query('search'), function ($q) use ($request) {
                $term = '%'.$request->query('search').'%';
                $q->whereHas('contact', function ($contact) use ($term) {
                    $contact->where('name', 'ilike', $term)->orWhere('email', 'ilike', $term);
                });
            })
            ->orderByDesc('last_activity_at')
            ->limit(30)
            ->get();

        $ids = $conversations->pluck('id');
        $latestByConversation = collect();
        if ($ids->isNotEmpty()) {
            $latestIds = Message::query()
                ->selectRaw('MAX(id) as id')
                ->whereIn('conversation_id', $ids)
                ->where('private', false)
                ->where('sender_type', '!=', 'note')
                ->groupBy('conversation_id')
                ->pluck('id');
            $latestByConversation = Message::query()
                ->whereIn('id', $latestIds)
                ->get(['id', 'conversation_id', 'body', 'sender_type', 'private', 'created_at'])
                ->keyBy('conversation_id');
        }
        $conversations->transform(function (Conversation $conversation) use ($latestByConversation) {
            $conversation->setAttribute('latest_message', $latestByConversation->get($conversation->id));

            return $conversation;
        });

        $messages = [];
        $conversationMeta = null;
        $conversationId = $request->integer('conversation_id');
        if ($conversationId) {
            $conversation = Conversation::query()->tap($scope)->find($conversationId);
            if ($conversation) {
                $afterId = $request->integer('after_id');
                $messages = Message::query()
                    ->with(['user:id,name', 'attachments', 'mentionedUsers:id,name'])
                    ->where('conversation_id', $conversation->id)
                    ->when($afterId, fn ($q) => $q->where('id', '>', $afterId))
                    ->orderBy('id')
                    ->limit(100)
                    ->get();
                $conversationMeta = [
                    'status' => $conversation->status,
                    'assignee_id' => $conversation->assignee_id,
                ];
            }
        }

        return response()->json([
            'data' => [
                'conversations' => $conversations,
                'messages' => $messages,
                'conversation' => $conversationMeta,
            ],
        ]);
    }
}
