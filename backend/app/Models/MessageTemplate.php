<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageTemplate extends Model
{
    protected $fillable = [
        'account_id',
        'name',
        'channel',
        'language',
        'body',
        'status',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
