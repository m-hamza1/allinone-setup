<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Macro extends Model
{
    protected $fillable = [
        'account_id',
        'name',
        'visibility',
        'user_id',
        'actions',
    ];

    protected function casts(): array
    {
        return [
            'actions' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
