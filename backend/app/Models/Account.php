<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    protected $fillable = ['name', 'slug', 'settings'];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function inboxes(): HasMany
    {
        return $this->hasMany(Inbox::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    public function labels(): HasMany
    {
        return $this->hasMany(Label::class);
    }

    public function cannedResponses(): HasMany
    {
        return $this->hasMany(CannedResponse::class);
    }

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    public function macros(): HasMany
    {
        return $this->hasMany(Macro::class);
    }

    public function customViews(): HasMany
    {
        return $this->hasMany(CustomView::class);
    }

    public function channelConnections(): HasMany
    {
        return $this->hasMany(ChannelConnection::class);
    }

    public function slaPolicies(): HasMany
    {
        return $this->hasMany(SlaPolicy::class);
    }

    public function helpCenterPortals(): HasMany
    {
        return $this->hasMany(HelpCenterPortal::class);
    }

    public function campaigns(): HasMany
    {
        return $this->hasMany(Campaign::class);
    }

    public function automationRules(): HasMany
    {
        return $this->hasMany(AutomationRule::class);
    }

    public function assignmentPolicies(): HasMany
    {
        return $this->hasMany(AssignmentPolicy::class);
    }

    public function messageTemplates(): HasMany
    {
        return $this->hasMany(MessageTemplate::class);
    }

    public function agentBots(): HasMany
    {
        return $this->hasMany(AgentBot::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    public function customRoles(): HasMany
    {
        return $this->hasMany(CustomRole::class);
    }
}
