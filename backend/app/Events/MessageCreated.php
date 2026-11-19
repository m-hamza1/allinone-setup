<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** Immediate broadcast so staff see widget messages without a queue worker. */
class MessageCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message)
    {
        $this->message->loadMissing(['user:id,name', 'attachments', 'mentionedUsers:id,name']);
    }

    public function broadcastOn(): array
    {
        $accountId = $this->message->conversation?->account_id
            ?? $this->message->conversation()->value('account_id');

        return [
            new PrivateChannel('account.'.$accountId),
            new PrivateChannel('conversation.'.$this->message->conversation_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'message.created';
    }

    public function broadcastWith(): array
    {
        return [
            'message' => $this->message,
        ];
    }
}
