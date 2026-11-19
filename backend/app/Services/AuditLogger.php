<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditLogger
{
    public static function log(User $user, string $action, ?Model $model = null, array $meta = []): void
    {
        $accountId = $user->account_id;

        if (! $accountId && $model && isset($model->account_id)) {
            $accountId = $model->account_id;
        }

        if (! $accountId) {
            return;
        }

        AuditLog::query()->create([
            'account_id' => $accountId,
            'user_id' => $user->id,
            'action' => $action,
            'auditable_type' => $model ? $model::class : null,
            'auditable_id' => $model?->getKey(),
            'meta' => $meta ?: null,
        ]);
    }
}
