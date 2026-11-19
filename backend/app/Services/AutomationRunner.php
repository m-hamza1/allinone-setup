<?php

namespace App\Services;

use App\Models\AssignmentPolicy;
use App\Models\AutomationRule;
use App\Models\Conversation;
use App\Models\Label;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AutomationRunner
{
    public const EVENTS = [
        'conversation_created',
        'conversation_resolved',
        'conversation_opened',
        'message_created',
        'conversation_assigned',
    ];

    public function run(string $event, Conversation $conversation): void
    {
        $conversation->refresh();
        $conversation->loadMissing(['inbox', 'labels']);

        $rules = AutomationRule::query()
            ->where('account_id', $conversation->account_id)
            ->where('active', true)
            ->where('event', $event)
            ->orderBy('id')
            ->get();

        foreach ($rules as $rule) {
            if (! $this->conditionsMatch($rule->conditions ?? [], $conversation)) {
                continue;
            }

            foreach ($rule->actions ?? [] as $action) {
                $this->applyAction($action, $conversation);
                $conversation->refresh();
            }
        }

        if ($event === 'conversation_created' && $conversation->assignee_id === null) {
            $this->applyActiveAssignmentPolicy($conversation);
        }

        $conversation->refresh();
    }

    private function conditionsMatch(array $conditions, Conversation $conversation): bool
    {
        if ($conditions === []) {
            return true;
        }

        // Support either flat map or list of {field, operator, value}
        if (array_is_list($conditions)) {
            foreach ($conditions as $condition) {
                if (! is_array($condition)) {
                    continue;
                }
                if (! $this->matchOne($condition, $conversation)) {
                    return false;
                }
            }

            return true;
        }

        if (isset($conditions['all']) && is_array($conditions['all'])) {
            foreach ($conditions['all'] as $condition) {
                if (! $this->matchOne((array) $condition, $conversation)) {
                    return false;
                }
            }

            return true;
        }

        // Legacy flat keys
        return $this->matchFlat($conditions, $conversation);
    }

    /**
     * @param  array<string, mixed>  $condition
     */
    private function matchOne(array $condition, Conversation $conversation): bool
    {
        $field = (string) ($condition['field'] ?? $condition['attribute'] ?? '');
        $operator = (string) ($condition['operator'] ?? 'eq');
        $expected = $condition['value'] ?? null;

        $actual = $this->fieldValue($field, $conversation);

        return match ($operator) {
            'neq', 'not_equals' => (string) $actual !== (string) $expected,
            'contains' => is_string($actual) && is_string($expected) && str_contains(strtolower($actual), strtolower($expected)),
            'is_set' => $actual !== null && $actual !== '',
            'is_not_set' => $actual === null || $actual === '',
            default => (string) $actual === (string) $expected,
        };
    }

    /**
     * @param  array<string, mixed>  $conditions
     */
    private function matchFlat(array $conditions, Conversation $conversation): bool
    {
        if (array_key_exists('status', $conditions) && $conditions['status'] !== null && $conditions['status'] !== '') {
            if ((string) $conversation->status !== (string) $conditions['status']) {
                return false;
            }
        }

        if (array_key_exists('inbox_id', $conditions) && $conditions['inbox_id'] !== null && $conditions['inbox_id'] !== '') {
            if ((int) $conversation->inbox_id !== (int) $conditions['inbox_id']) {
                return false;
            }
        }

        if (array_key_exists('channel', $conditions) && $conditions['channel'] !== null && $conditions['channel'] !== '') {
            if ((string) ($conversation->inbox?->channel) !== (string) $conditions['channel']) {
                return false;
            }
        }

        if (array_key_exists('priority', $conditions) && $conditions['priority'] !== null && $conditions['priority'] !== '') {
            if ((string) $conversation->priority !== (string) $conditions['priority']) {
                return false;
            }
        }

        if (! empty($conditions['unassigned'])) {
            if ($conversation->assignee_id !== null) {
                return false;
            }
        }

        if (array_key_exists('team_id', $conditions) && $conditions['team_id'] !== null && $conditions['team_id'] !== '') {
            if ((int) $conversation->team_id !== (int) $conditions['team_id']) {
                return false;
            }
        }

        return true;
    }

    private function fieldValue(string $field, Conversation $conversation): mixed
    {
        return match ($field) {
            'status' => $conversation->status,
            'inbox_id' => $conversation->inbox_id,
            'channel' => $conversation->inbox?->channel,
            'priority' => $conversation->priority,
            'assignee_id' => $conversation->assignee_id,
            'team_id' => $conversation->team_id,
            'unassigned' => $conversation->assignee_id === null ? '1' : '0',
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $action
     */
    private function applyAction(array $action, Conversation $conversation): void
    {
        $type = $action['type'] ?? null;

        if ($type === 'assign') {
            $assignee = $action['assignee'] ?? $action['assignee_id'] ?? null;
            if ($assignee === 'round_robin') {
                $userId = $this->pickRoundRobinAssignee($conversation->account_id);
                if ($userId) {
                    $conversation->update(['assignee_id' => $userId]);
                }
            } elseif (is_numeric($assignee)) {
                $conversation->update(['assignee_id' => (int) $assignee]);
            }

            return;
        }

        if ($type === 'label' || $type === 'add_label') {
            $labelId = $action['label_id'] ?? null;
            if ($labelId) {
                $exists = Label::query()
                    ->where('account_id', $conversation->account_id)
                    ->where('id', $labelId)
                    ->exists();
                if ($exists) {
                    $conversation->labels()->syncWithoutDetaching([(int) $labelId]);
                }
            }

            return;
        }

        if ($type === 'remove_label') {
            $labelId = $action['label_id'] ?? null;
            if ($labelId) {
                $conversation->labels()->detach([(int) $labelId]);
            }

            return;
        }

        if ($type === 'status') {
            $status = $action['status'] ?? null;
            if ($status) {
                $conversation->update(['status' => $status]);
            }

            return;
        }

        if ($type === 'priority') {
            $priority = $action['priority'] ?? null;
            if ($priority) {
                $conversation->update(['priority' => $priority]);
            }

            return;
        }

        if ($type === 'team' || $type === 'assign_team') {
            $teamId = $action['team_id'] ?? null;
            if ($teamId) {
                $conversation->update(['team_id' => (int) $teamId]);
            }

            return;
        }

        if ($type === 'snooze') {
            $until = $action['until'] ?? $action['snoozed_until'] ?? null;
            if ($until) {
                $conversation->update([
                    'snoozed_until' => $until,
                    'status' => 'snoozed',
                ]);
            }

            return;
        }

        if ($type === 'private_note' || $type === 'send_message') {
            $body = (string) ($action['body'] ?? $action['content'] ?? '');
            if ($body === '') {
                return;
            }
            Message::query()->create([
                'conversation_id' => $conversation->id,
                'user_id' => null,
                'sender_type' => 'staff',
                'private' => ($type === 'private_note') || ! empty($action['private']),
                'body' => $body,
            ]);
            $conversation->update(['last_activity_at' => now()]);
        }
    }

    public function applyActiveAssignmentPolicy(Conversation $conversation): void
    {
        if ($conversation->assignee_id !== null) {
            return;
        }

        $policy = AssignmentPolicy::query()
            ->where('account_id', $conversation->account_id)
            ->where('active', true)
            ->orderByDesc('id')
            ->first();

        if (! $policy || $policy->strategy !== 'round_robin') {
            return;
        }

        $userId = $this->pickRoundRobinAssignee($conversation->account_id);
        if ($userId) {
            $conversation->update(['assignee_id' => $userId]);
        }
    }

    public function pickRoundRobinAssignee(int $accountId): ?int
    {
        $staff = User::query()
            ->where('account_id', $accountId)
            ->whereIn('role', ['staff', 'admin'])
            ->pluck('id');

        if ($staff->isEmpty()) {
            return null;
        }

        $counts = Conversation::query()
            ->select('assignee_id', DB::raw('COUNT(*) as open_count'))
            ->where('account_id', $accountId)
            ->where('status', 'open')
            ->whereIn('assignee_id', $staff)
            ->groupBy('assignee_id')
            ->pluck('open_count', 'assignee_id');

        $bestId = null;
        $bestCount = PHP_INT_MAX;

        foreach ($staff as $userId) {
            $count = (int) ($counts[$userId] ?? 0);
            if ($count < $bestCount) {
                $bestCount = $count;
                $bestId = $userId;
            }
        }

        return $bestId;
    }
}
