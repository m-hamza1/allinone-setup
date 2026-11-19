<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomAttributeDefinition extends Model
{
    protected $fillable = [
        'account_id',
        'key',
        'label',
        'attribute_type',
        'options',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
