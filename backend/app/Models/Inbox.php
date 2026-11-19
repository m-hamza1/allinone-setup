<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Inbox extends Model
{
    protected $fillable = [
        'account_id',
        'name',
        'channel',
        'widget_token',
        'channel_config',
    ];

    protected function casts(): array
    {
        return [
            'channel_config' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Inbox $inbox) {
            if (empty($inbox->widget_token)) {
                $inbox->widget_token = Str::random(40);
            }
        });
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }
}
