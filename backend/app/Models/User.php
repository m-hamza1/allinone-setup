<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements CanResetPasswordContract
{
    /** @use HasFactory<UserFactory> */
    use CanResetPassword, HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'account_id',
        'name',
        'email',
        'google_id',
        'password',
        'role',
        'custom_role_id',
        'two_factor_secret',
        'two_factor_confirmed_at',
        'two_factor_recovery_codes',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'two_factor_recovery_codes' => 'array',
        ];
    }

    public function hasTwoFactorEnabled(): bool
    {
        return filled($this->two_factor_secret) && filled($this->two_factor_confirmed_at);
    }

    public function consumeRecoveryCode(string $code): bool
    {
        $hashed = hash('sha256', strtoupper(trim($code)));
        $codes = $this->two_factor_recovery_codes ?? [];
        if (! in_array($hashed, $codes, true)) {
            return false;
        }
        $this->forceFill([
            'two_factor_recovery_codes' => array_values(array_filter($codes, fn ($c) => $c !== $hashed)),
        ])->save();

        return true;
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function customRole(): BelongsTo
    {
        return $this->belongsTo(CustomRole::class);
    }

    public function assignedConversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'assignee_id');
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin' || $this->isSuperAdmin();
    }

    public function isStaff(): bool
    {
        return in_array($this->role, ['staff', 'admin', 'super_admin'], true);
    }

    /**
     * Effective permission keys for this user.
     *
     * @return list<string>
     */
    public function permissionKeys(): array
    {
        if ($this->isAdmin()) {
            return \App\Support\PermissionCatalog::keys();
        }

        $this->loadMissing('customRole');
        if ($this->customRole && is_array($this->customRole->permissions)) {
            return array_values(array_intersect(
                \App\Support\PermissionCatalog::keys(),
                $this->customRole->permissions,
            ));
        }

        return \App\Support\PermissionCatalog::staffDefaults();
    }

    public function canPermission(string $permission): bool
    {
        if ($this->isAdmin()) {
            return true;
        }

        return in_array($permission, $this->permissionKeys(), true);
    }
}
