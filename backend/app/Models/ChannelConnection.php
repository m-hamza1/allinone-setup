<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChannelConnection extends Model
{
    protected $fillable = [
        'account_id',
        'inbox_id',
        'provider',
        'status',
        'credentials',
        'meta',
    ];

    protected $hidden = [
        'credentials',
    ];

    protected function casts(): array
    {
        return [
            'credentials' => 'array',
            'meta' => 'array',
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
