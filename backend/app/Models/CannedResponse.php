<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CannedResponse extends Model
{
    protected $fillable = [
        'account_id',
        'short_code',
        'content',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
