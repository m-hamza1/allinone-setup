<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HelpCenterCategory extends Model
{
    protected $fillable = [
        'portal_id',
        'name',
        'slug',
        'position',
    ];

    public function portal(): BelongsTo
    {
        return $this->belongsTo(HelpCenterPortal::class, 'portal_id');
    }

    public function articles(): HasMany
    {
        return $this->hasMany(HelpCenterArticle::class, 'category_id');
    }
}
