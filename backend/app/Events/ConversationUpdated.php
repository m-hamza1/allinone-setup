<?php

namespace App\Events;

use App\Models\Conversation;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Conversation $conversation)
    {
        $this->conversation->loadMissing(['contact:id,name,email', 'assignee:id,name', 'inbox:id,name']);
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('account.'.$this->conversation->account_id),
            new PrivateChannel('conversation.'.$this->conversation->id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'conversation.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation' => $this->conversation->only([
                'id', 'status', 'assignee_id', 'account_id', 'inbox_id', 'contact_id', 'last_activity_at',
            ]),
        ];
    }
}
