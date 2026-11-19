<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomView extends Model
{
    protected $fillable = [
        'account_id',
        'user_id',
        'name',
        'filters',
        'is_shared',
    ];

    protected function casts(): array
    {
        return [
            'filters' => 'array',
            'is_shared' => 'boolean',
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
