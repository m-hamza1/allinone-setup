<?php

namespace App\Events;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ViewerJoined implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Conversation $conversation, public User $viewer)
    {
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversation.'.$this->conversation->id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'viewer.joined';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversation->id,
            'viewer' => $this->viewer->only(['id', 'name']),
        ];
    }
}
