<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentPolicy extends Model
{
    protected $fillable = [
        'account_id',
        'name',
        'strategy',
        'active',
        'config',
    ];

    protected function casts(): array
    {
        return [
            'config' => 'array',
            'active' => 'boolean',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
