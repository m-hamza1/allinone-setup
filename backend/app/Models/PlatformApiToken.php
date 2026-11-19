<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class PlatformApiToken extends Model
{
    protected $fillable = [
        'account_id',
        'user_id',
        'name',
        'token_prefix',
        'token_hash',
        'abilities',
        'last_used_at',
    ];

    protected function casts(): array
    {
        return [
            'abilities' => 'array',
            'last_used_at' => 'datetime',
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

    /**
     * @return array{token: string, model: self}
     */
    public static function issue(Account $account, User $user, string $name, array $abilities = ['*']): array
    {
        $plain = 'allin_'.Str::random(40);
        $prefix = substr($plain, 0, 12);
        $model = self::query()->create([
            'account_id' => $account->id,
            'user_id' => $user->id,
            'name' => $name,
            'token_prefix' => $prefix,
            'token_hash' => hash('sha256', $plain),
            'abilities' => $abilities,
        ]);

        return ['token' => $plain, 'model' => $model];
    }

    public static function findByPlainToken(string $plain): ?self
    {
        return self::query()->where('token_hash', hash('sha256', $plain))->first();
    }
}
