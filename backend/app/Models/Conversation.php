<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    protected $fillable = [
        'account_id',
        'inbox_id',
        'contact_id',
        'assignee_id',
        'participant_ids',
        'team_id',
        'sla_policy_id',
        'locked_by',
        'locked_at',
        'status',
        'csat_score',
        'csat_submitted_at',
        'last_activity_at',
        'first_reply_at',
        'sla_due_at',
        'first_response_due_at',
        'priority',
        'snoozed_until',
        'muted',
    ];

    protected function casts(): array
    {
        return [
            'last_activity_at' => 'datetime',
            'locked_at' => 'datetime',
            'csat_submitted_at' => 'datetime',
            'first_reply_at' => 'datetime',
            'sla_due_at' => 'datetime',
            'first_response_due_at' => 'datetime',
            'snoozed_until' => 'datetime',
            'muted' => 'boolean',
            'participant_ids' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function inbox(): BelongsTo
    {
        return $this->belongsTo(Inbox::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function locker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by');
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function slaPolicy(): BelongsTo
    {
        return $this->belongsTo(SlaPolicy::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(Label::class)->withTimestamps();
    }

    public function viewers(): HasMany
    {
        return $this->hasMany(ConversationViewer::class);
    }

    public function csatResponses(): HasMany
    {
        return $this->hasMany(CsatResponse::class);
    }
}
