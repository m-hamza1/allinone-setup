<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Label extends Model
{
    protected $fillable = [
        'account_id',
        'title',
        'color',
        'description',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function conversations(): BelongsToMany
    {
        return $this->belongsToMany(Conversation::class)->withTimestamps();
    }
}
