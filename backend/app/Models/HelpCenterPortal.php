<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HelpCenterPortal extends Model
{
    protected $fillable = [
        'account_id',
        'name',
        'slug',
        'headline',
        'default_locale',
        'locales',
        'is_published',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'locales' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(HelpCenterCategory::class, 'portal_id');
    }

    public function articles(): HasMany
    {
        return $this->hasMany(HelpCenterArticle::class, 'portal_id');
    }
}
