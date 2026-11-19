<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageCreated;
use App\Events\ViewerJoined;
use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\ConversationViewer;
use App\Models\CsatResponse;
use App\Models\Label;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Account;
use App\Models\AssignmentPolicy;
use App\Models\User;
use App\Services\AutomationRunner;
use App\Services\ConversationSlaService;
use App\Services\EmailChannelService;
use App\Services\IntegrationDispatcher;
use App\Services\MetaMessengerService;
use App\Services\TwilioSmsService;
use App\Services\WhatsAppCloudService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class ConversationController extends Controller
{
    use AuthorizesAccount;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'conversation_manage');

        return response()->json($this->paginateConversationList($request, $user));
    }

    public function mentions(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json($this->paginateConversationList($request, $user, mentionsOnly: true));
    }

    public function updateMeta(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $conversation);

        $data = $request->validate([
            'priority' => ['sometimes', 'nullable', 'in:none,low,medium,high,urgent'],
            'snoozed_until' => ['sometimes', 'nullable', 'date'],
            'muted' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('snoozed_until', $data) && $data['snoozed_until'] === null) {
            $data['snoozed_until'] = null;
        }

        $conversation->update($data);

        return response()->json([
            'data' => $conversation->fresh([
                'contact:id,name,email',
                'assignee:id,name',
                'inbox:id,name',
                'labels:id,title,color',
            ]),
        ]);
    }

    /**
     * @return LengthAwarePaginator<int, Conversation>
     */
    private function paginateConversationList(Request $request, User $user, bool $mentionsOnly = false): LengthAwarePaginator
    {
        $conversations = Conversation::query()
            ->with([
                'contact:id,name,email',
                'assignee:id,name',
                'inbox:id,name',
                'labels:id,title,color',
            ])
            ->withMax('messages as latest_message_at', 'created_at')
            ->tap($this->accountScope($user))
            ->when($request->query('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->when($request->query('assignee') === 'me' || $request->query('assignee_id') === 'me', fn ($q) => $q->where('assignee_id', $user->id))
            ->when($request->query('assignee') === 'unassigned', fn ($q) => $q->whereNull('assignee_id'))
            ->when(
                is_numeric($request->query('assignee_id')),
                fn ($q) => $q->where('assignee_id', (int) $request->query('assignee_id')),
            )
            ->when($request->query('inbox_id'), fn ($q) => $q->where('inbox_id', $request->query('inbox_id')))
            ->when($request->query('priority'), fn ($q) => $q->where('priority', $request->query('priority')))
            ->when(
                filter_var($request->query('mentions'), FILTER_VALIDATE_BOOLEAN) || $mentionsOnly,
                fn ($q) => $q->whereHas(
                    'messages.mentionedUsers',
                    fn ($mentions) => $mentions->where('users.id', $user->id),
                ),
            )
            ->when($request->query('label_id'), function ($q) use ($request) {
                $q->whereHas('labels', fn ($labels) => $labels->where('labels.id', $request->query('label_id')));
            })
            ->when(
                filter_var($request->query('participating'), FILTER_VALIDATE_BOOLEAN),
                fn ($q) => $q->whereJsonContains('participant_ids', $user->id),
            )
            ->when(
                filter_var($request->query('unattended'), FILTER_VALIDATE_BOOLEAN),
                fn ($q) => $q->whereNull('assignee_id')->where('status', 'open'),
            )
            ->when($request->query('search'), function ($q) use ($request) {
                $term = '%'.$request->query('search').'%';
                $q->whereHas('contact', function ($contact) use ($term) {
                    $contact->where('name', 'ilike', $term)
                        ->orWhere('email', 'ilike', $term);
                });
            })
            ->orderByDesc('last_activity_at')
            ->paginate(30);

        $ids = $conversations->getCollection()->pluck('id');
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

        $conversations->getCollection()->transform(function (Conversation $conversation) use ($latestByConversation) {
            $conversation->setAttribute('latest_message', $latestByConversation->get($conversation->id));

            return $conversation;
        });

        return $conversations;
    }

    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        $this->authorizeAccount($request->user(), $conversation);

        $conversation->load([
            'contact:id,name,email,phone,custom_attributes',
            'assignee:id,name,email',
            'inbox:id,name,channel',
            'team:id,name',
            'labels:id,title,color',
            'locker:id,name',
            'messages' => fn ($q) => $q->orderBy('created_at'),
            'messages.user:id,name',
            'messages.attachments',
            'messages.mentionedUsers:id,name',
        ]);

        $viewers = ConversationViewer::query()
            ->with('user:id,name')
            ->where('conversation_id', $conversation->id)
            ->where('last_seen_at', '>=', now()->subSeconds(45))
            ->get()
            ->map(fn ($v) => ['id' => $v->user_id, 'name' => $v->user?->name]);

        $conversation->setAttribute('active_viewers', $viewers);

        return response()->json(['data' => $conversation]);
    }

    public function messages(Request $request, Conversation $conversation): JsonResponse
    {
        $this->authorizeAccount($request->user(), $conversation);

        $data = $request->validate([
            'after_id' => ['nullable', 'integer'],
        ]);

        $messages = Message::query()
            ->with(['user:id,name', 'attachments', 'mentionedUsers:id,name'])
            ->where('conversation_id', $conversation->id)
            ->when($data['after_id'] ?? null, fn ($q, $id) => $q->where('id', '>', $id))
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $messages,
            'conversation' => [
                'id' => $conversation->id,
                'status' => $conversation->status,
                'assignee_id' => $conversation->assignee_id,
                'last_activity_at' => $conversation->last_activity_at,
            ],
        ]);
    }

    public function reply(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'conversation_manage');
        $this->authorizeAccount($user, $conversation);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'private' => ['sometimes', 'boolean'],
            'mention_ids' => ['sometimes', 'array'],
            'mention_ids.*' => ['integer', 'exists:users,id'],
            'attachments' => ['sometimes', 'array', 'max:5'],
            'attachments.*' => ['file', 'max:10240'],
        ]);

        $isPrivate = filter_var($data['private'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'sender_type' => $isPrivate ? 'note' : 'staff',
            'private' => $isPrivate,
            'body' => $data['body'],
        ]);

        if (! empty($data['mention_ids'])) {
            $message->mentionedUsers()->sync($data['mention_ids']);
        } else {
            preg_match_all('/@([a-zA-Z0-9._-]+)/', $data['body'], $matches);
            if (! empty($matches[1])) {
                $ids = User::query()
                    ->when($user->account_id, fn ($q) => $q->where('account_id', $user->account_id))
                    ->where(function ($q) use ($matches) {
                        foreach ($matches[1] as $handle) {
                            $q->orWhere('email', 'ilike', $handle.'%')
                                ->orWhere('name', 'ilike', str_replace('.', ' ', $handle).'%');
                        }
                    })
                    ->pluck('id');
                if ($ids->isNotEmpty()) {
                    $message->mentionedUsers()->sync($ids->all());
                }
            }
        }

        foreach ($request->file('attachments', []) as $file) {
            $path = $file->store('attachments/'.$conversation->id, 'public');
            MessageAttachment::query()->create([
                'message_id' => $message->id,
                'disk' => 'public',
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size' => $file->getSize() ?: 0,
            ]);
        }

        $updates = [
            'last_activity_at' => now(),
            'status' => $isPrivate ? $conversation->status : 'open',
            'assignee_id' => $conversation->assignee_id ?: $user->id,
        ];
        if (! $isPrivate && ! $conversation->first_reply_at) {
            $updates['first_reply_at'] = now();
        }
        if (! $isPrivate) {
            $participants = $conversation->participant_ids ?? [];
            if (! in_array($user->id, $participants, true)) {
                $participants[] = $user->id;
                $updates['participant_ids'] = array_values($participants);
            }
        }
        $conversation->update($updates);

        $message->load(['user:id,name', 'attachments', 'mentionedUsers:id,name']);

        try {
            broadcast(new MessageCreated($message))->toOthers();
        } catch (\Throwable) {
            // Queue/Reverb must not stall replies on single-thread serve
        }

        $channelDelivery = null;
        $conversation->loadMissing('inbox');
        $channel = $conversation->inbox?->channel;
        if (! $isPrivate) {
            try {
                if ($channel === 'email') {
                    $channelDelivery = app(EmailChannelService::class)->sendReply($conversation, $data['body']);
                } elseif ($channel === 'whatsapp') {
                    $channelDelivery = app(WhatsAppCloudService::class)->sendReply($conversation, $data['body']);
                } elseif (in_array($channel, ['facebook', 'instagram'], true)) {
                    $channelDelivery = app(MetaMessengerService::class)->sendReply($conversation, $data['body'], $channel);
                } elseif ($channel === 'sms') {
                    $channelDelivery = app(TwilioSmsService::class)->sendReply($conversation, $data['body']);
                }
            } catch (\Throwable $e) {
                $channelDelivery = ['ok' => false, 'mode' => 'live', 'detail' => $e->getMessage()];
            }

            try {
                app(AutomationRunner::class)->run('message_created', $conversation->fresh());
            } catch (\Throwable) {
                // best-effort automation
            }

            try {
                app(IntegrationDispatcher::class)->dispatch(
                    'message_created',
                    $conversation->fresh(['contact', 'inbox', 'assignee', 'account']),
                    $message,
                );
            } catch (\Throwable) {
                // best-effort integrations
            }
        }

        return response()->json([
            'data' => $message,
            'email_delivery' => $channel === 'email' ? $channelDelivery : null,
            'channel_delivery' => $channelDelivery,
        ], 201);
    }

    public function presence(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $conversation);

        $viewer = ConversationViewer::query()->firstOrNew([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
        ]);
        $isFreshJoin = ! $viewer->exists
            || ! $viewer->last_seen_at
            || $viewer->last_seen_at->lt(now()->subSeconds(90));

        $viewer->last_seen_at = now();
        $viewer->save();

        $conversation->update([
            'locked_by' => $user->id,
            'locked_at' => now(),
        ]);

        // Only announce join occasionally — heartbeats must stay cheap on single-thread serve.
        if ($isFreshJoin) {
            try {
                broadcast(new ViewerJoined($conversation, $user))->toOthers();
            } catch (\Throwable) {
                // ignore broadcast failures in local serve
            }
        }

        $viewers = ConversationViewer::query()
            ->with('user:id,name')
            ->where('conversation_id', $conversation->id)
            ->where('last_seen_at', '>=', now()->subSeconds(45))
            ->where('user_id', '!=', $user->id)
            ->get()
            ->map(fn ($v) => ['id' => $v->user_id, 'name' => $v->user?->name]);

        return response()->json([
            'data' => [
                'locked_by' => $user->id,
                'active_viewers' => $viewers,
            ],
        ]);
    }

    public function assignTeam(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $conversation);

        $data = $request->validate([
            'team_id' => ['nullable', 'integer', 'exists:teams,id'],
        ]);

        $conversation->update(['team_id' => $data['team_id'] ?? null]);

        return response()->json([
            'data' => $conversation->fresh(['team:id,name', 'assignee:id,name', 'labels:id,title,color']),
        ]);
    }

    public function submitCsat(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'widget_token' => ['required', 'string'],
            'score' => ['required', 'integer', 'min:1', 'max:5'],
            'feedback' => ['nullable', 'string', 'max:500'],
        ]);

        $conversation->loadMissing('inbox');
        abort_unless($conversation->inbox && $conversation->inbox->widget_token === $data['widget_token'], 403);

        $csat = CsatResponse::query()->create([
            'account_id' => $conversation->account_id,
            'conversation_id' => $conversation->id,
            'contact_id' => $conversation->contact_id,
            'score' => $data['score'],
            'feedback' => $data['feedback'] ?? null,
        ]);

        $conversation->update([
            'csat_score' => $data['score'],
            'csat_submitted_at' => now(),
        ]);

        return response()->json(['data' => $csat], 201);
    }

    public function syncLabels(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $conversation);

        $data = $request->validate([
            'label_ids' => ['present', 'array'],
            'label_ids.*' => ['integer', 'exists:labels,id'],
        ]);

        $labelIds = collect($data['label_ids'])->unique()->values();

        if ($labelIds->isNotEmpty()) {
            $validCount = Label::query()
                ->whereIn('id', $labelIds)
                ->when(
                    $user->account_id,
                    fn ($q) => $q->where('account_id', $user->account_id),
                )
                ->count();

            abort_unless($validCount === $labelIds->count(), 422, 'Invalid labels for this account');
        }

        $conversation->labels()->sync($labelIds->all());

        return response()->json([
            'data' => $conversation->fresh(['labels:id,title,color', 'assignee:id,name']),
        ]);
    }

    public function assign(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeAccount($user, $conversation);

        $data = $request->validate([
            'assignee_id' => ['nullable', 'exists:users,id'],
        ]);

        $explicitNullAssignee = array_key_exists('assignee_id', $data) && $data['assignee_id'] === null;

        if ($explicitNullAssignee) {
            $roundRobinPolicyActive = AssignmentPolicy::query()
                ->where('account_id', $conversation->account_id)
                ->where('active', true)
                ->where('strategy', 'round_robin')
                ->exists();

            if ($roundRobinPolicyActive) {
                return response()->json([
                    'data' => $conversation->fresh(['assignee:id,name', 'labels:id,title,color']),
                ]);
            }
        }

        $assigneeId = array_key_exists('assignee_id', $data)
            ? $data['assignee_id']
            : $user->id;

        if ($assigneeId) {
            $assignee = User::query()->findOrFail($assigneeId);
            if (! $user->isSuperAdmin()) {
                abort_unless($assignee->account_id === $user->account_id, 422, 'Assignee must be on the same account');
            }
        }

        $conversation->update(['assignee_id' => $assigneeId]);
        app(ConversationSlaService::class)->apply($conversation->fresh(), onAssign: true);

        try {
            app(AutomationRunner::class)->run('conversation_assigned', $conversation->fresh());
        } catch (\Throwable) {
            // best-effort automation
        }

        return response()->json(['data' => $conversation->fresh(['assignee:id,name', 'labels:id,title,color'])]);
    }

    public function resolve(Request $request, Conversation $conversation): JsonResponse
    {
        $this->authorizeAccount($request->user(), $conversation);

        $conversation->update(['status' => 'resolved']);

        try {
            app(AutomationRunner::class)->run('conversation_resolved', $conversation->fresh());
        } catch (\Throwable) {
            // best-effort automation
        }

        $fresh = $conversation->fresh(['assignee:id,name', 'labels:id,title,color', 'inbox:id,widget_token']);

        $payload = ['data' => $fresh];
        $account = Account::query()->find($conversation->account_id);
        $settings = array_merge(
            ['enable_csat' => true],
            $account?->settings ?? [],
        );
        if ($settings['enable_csat'] ?? false) {
            $payload['csat'] = [
                'enabled' => true,
                'widget_token' => $fresh->inbox?->widget_token,
                'endpoint' => '/api/widget/conversations/'.$conversation->id.'/csat',
            ];
        }

        return response()->json($payload);
    }

    public function reopen(Request $request, Conversation $conversation): JsonResponse
    {
        $this->authorizeAccount($request->user(), $conversation);

        $conversation->update(['status' => 'open']);

        try {
            app(AutomationRunner::class)->run('conversation_opened', $conversation->fresh());
        } catch (\Throwable) {
            // best-effort automation
        }

        return response()->json(['data' => $conversation->fresh(['assignee:id,name', 'labels:id,title,color'])]);
    }
}
