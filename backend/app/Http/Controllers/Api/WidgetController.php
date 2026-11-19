<?php

namespace App\Http\Controllers\Api;

use App\Events\ConversationUpdated;
use App\Events\MessageCreated;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Inbox;
use App\Models\Message;
use App\Services\AutomationRunner;
use App\Services\ConversationSlaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WidgetController extends Controller
{
    public function bootstrap(Request $request): JsonResponse
    {
        $data = $request->validate([
            'widget_token' => ['required', 'string'],
        ]);

        $inbox = Inbox::query()->where('widget_token', $data['widget_token'])->firstOrFail();
        $inbox->loadMissing('account');
        $settings = $inbox->account?->settings ?? [];

        return response()->json([
            'data' => [
                'inbox_id' => $inbox->id,
                'inbox_name' => $inbox->name,
                'channel' => $inbox->channel,
                'account_id' => $inbox->account_id,
                'widget_title' => $settings['widget_title'] ?? $inbox->name,
                'widget_tagline' => $settings['widget_tagline'] ?? 'We typically reply in a few minutes',
                'enable_csat' => (bool) ($settings['enable_csat'] ?? true),
                'pre_chat' => [
                    'collect_name' => (bool) ($settings['widget_collect_name'] ?? true),
                    'collect_email' => (bool) ($settings['widget_collect_email'] ?? true),
                    'require_email' => (bool) ($settings['widget_require_email'] ?? false),
                ],
                'theme' => [
                    'primary' => $settings['widget_primary_color'] ?? '#0f6e56',
                    'bubble_position' => $settings['widget_bubble_position'] ?? 'right',
                ],
            ],
        ]);
    }

    public function start(Request $request): JsonResponse
    {
        $data = $request->validate([
            'widget_token' => ['required', 'string'],
            'name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'message' => ['required', 'string', 'max:5000'],
            'conversation_id' => ['nullable', 'integer', 'exists:conversations,id'],
        ]);

        $inbox = Inbox::query()->where('widget_token', $data['widget_token'])->firstOrFail();
        $inbox->loadMissing('account');
        $settings = $inbox->account?->settings ?? [];
        if (! empty($settings['widget_require_email'])) {
            abort_unless(! empty($data['email']), 422, 'Email is required');
        }

        if (! empty($data['conversation_id'])) {
            $conversation = Conversation::query()->findOrFail($data['conversation_id']);
            abort_unless($conversation->inbox_id === $inbox->id, 403);

            $message = Message::query()->create([
                'conversation_id' => $conversation->id,
                'user_id' => null,
                'sender_type' => 'customer',
                'body' => $data['message'],
            ]);

            $conversation->update([
                'last_activity_at' => now(),
                'status' => 'open',
            ]);
            $this->pushLive($message, $conversation);

            return response()->json([
                'data' => [
                    'conversation_id' => $conversation->id,
                    'contact_id' => $conversation->contact_id,
                    'message' => $message,
                ],
            ], 201);
        }

        $contact = null;
        if (! empty($data['email'])) {
            $contact = Contact::query()
                ->where('account_id', $inbox->account_id)
                ->where('email', $data['email'])
                ->first();
        }

        if (! $contact) {
            $contact = Contact::query()->create([
                'account_id' => $inbox->account_id,
                'name' => $data['name'] ?? 'Visitor',
                'email' => $data['email'] ?? null,
            ]);
        } elseif (! empty($data['name']) && $contact->name === 'Visitor') {
            $contact->update(['name' => $data['name']]);
        }

        $openConversation = Conversation::query()
            ->where('inbox_id', $inbox->id)
            ->where('contact_id', $contact->id)
            ->where('status', 'open')
            ->orderByDesc('id')
            ->first();

        $conversation = $openConversation ?: Conversation::query()->create([
            'account_id' => $inbox->account_id,
            'inbox_id' => $inbox->id,
            'contact_id' => $contact->id,
            'status' => 'open',
            'last_activity_at' => now(),
        ]);

        if (! $openConversation) {
            app(ConversationSlaService::class)->apply($conversation);
            try {
                app(AutomationRunner::class)->run('conversation_created', $conversation->fresh());
            } catch (\Throwable) {
                // best-effort automation
            }
        }

        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => null,
            'sender_type' => 'customer',
            'body' => $data['message'],
        ]);

        $conversation->update(['last_activity_at' => now()]);
        $this->pushLive($message, $conversation);

        return response()->json([
            'data' => [
                'conversation_id' => $conversation->id,
                'contact_id' => $contact->id,
                'message' => $message,
                'messages' => Message::query()
                    ->where('conversation_id', $conversation->id)
                    ->where('private', false)
                    ->where('sender_type', '!=', 'note')
                    ->orderBy('id')
                    ->get(),
            ],
        ], 201);
    }

    public function message(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'widget_token' => ['required', 'string'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $inbox = Inbox::query()->where('widget_token', $data['widget_token'])->firstOrFail();
        abort_unless($conversation->inbox_id === $inbox->id, 403);

        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => null,
            'sender_type' => 'customer',
            'body' => $data['body'],
        ]);

        $conversation->update(['last_activity_at' => now(), 'status' => 'open']);
        $this->pushLive($message, $conversation);

        return response()->json(['data' => $message], 201);
    }

    public function poll(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'widget_token' => ['required', 'string'],
            'after_id' => ['nullable', 'integer'],
        ]);

        $inbox = Inbox::query()->where('widget_token', $data['widget_token'])->firstOrFail();
        abort_unless($conversation->inbox_id === $inbox->id, 403);

        $messages = Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('private', false)
            ->where('sender_type', '!=', 'note')
            ->when($data['after_id'] ?? null, fn ($q, $id) => $q->where('id', '>', $id))
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $messages,
            'conversation' => [
                'id' => $conversation->id,
                'status' => $conversation->status,
            ],
        ]);
    }

    private function pushLive(Message $message, Conversation $conversation): void
    {
        try {
            broadcast(new MessageCreated($message))->toOthers();
            broadcast(new ConversationUpdated($conversation->fresh() ?? $conversation))->toOthers();
        } catch (\Throwable) {
            // Reverb down must not fail the visitor message
        }
    }
}
