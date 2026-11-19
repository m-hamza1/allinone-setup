<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Campaign extends Model
{
    protected $fillable = [
        'account_id',
        'inbox_id',
        'title',
        'campaign_type',
        'status',
        'message',
        'audience',
        'scheduled_at',
        'launched_at',
    ];

    protected function casts(): array
    {
        return [
            'audience' => 'array',
            'scheduled_at' => 'datetime',
            'launched_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function inbox(): BelongsTo
    {
        return $this->belongsTo(Inbox::class);
    }
}
