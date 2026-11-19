<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contact extends Model
{
    protected $fillable = [
        'account_id',
        'name',
        'email',
        'phone',
        'custom_attributes',
    ];

    protected function casts(): array
    {
        return [
            'custom_attributes' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    public function notes(): HasMany
    {
        return $this->hasMany(ContactNote::class);
    }
}
