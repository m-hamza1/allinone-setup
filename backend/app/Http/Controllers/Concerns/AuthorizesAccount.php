<?php

namespace App\Http\Controllers\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

trait AuthorizesAccount
{
    protected function authorizeAccount(User $user, Model $model): void
    {
        if ($user->isSuperAdmin()) {
            return;
        }

        abort_unless(
            isset($model->account_id) && $user->account_id === $model->account_id,
            403,
        );
    }

    protected function requirePermission(User $user, string $permission): void
    {
        abort_unless($user->canPermission($permission), 403, 'Missing permission: '.$permission);
    }

    protected function accountScope(User $user)
    {
        return function ($query) use ($user) {
            if ($user->account_id) {
                $query->where('account_id', $user->account_id);
            }
        };
    }
}
