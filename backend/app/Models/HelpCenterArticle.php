<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HelpCenterArticle extends Model
{
    protected $fillable = [
        'portal_id',
        'category_id',
        'title',
        'slug',
        'body',
        'status',
        'locale',
    ];

    public function portal(): BelongsTo
    {
        return $this->belongsTo(HelpCenterPortal::class, 'portal_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(HelpCenterCategory::class, 'category_id');
    }
}
