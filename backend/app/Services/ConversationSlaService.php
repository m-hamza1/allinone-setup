<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\SlaPolicy;
use Carbon\Carbon;

class ConversationSlaService
{
    public function apply(Conversation $conversation, bool $onAssign = false): void
    {
        if ($conversation->sla_due_at && $conversation->first_response_due_at && ! $onAssign) {
            return;
        }

        $policy = $this->resolvePolicy($conversation);
        if (! $policy) {
            return;
        }

        $now = now();
        $updates = [];

        if (! $conversation->sla_policy_id) {
            $updates['sla_policy_id'] = $policy->id;
        }

        if (! $conversation->sla_due_at || $onAssign) {
            $updates['sla_due_at'] = $this->addBusinessMinutes(
                $now->copy(),
                (int) $policy->resolution_minutes,
                $policy,
            );
        }

        if (! $conversation->first_response_due_at && ! $conversation->first_reply_at) {
            $frt = (int) ($policy->first_response_minutes ?: 15);
            $updates['first_response_due_at'] = $this->addBusinessMinutes($now->copy(), $frt, $policy);
        }

        if ($updates !== []) {
            $conversation->update($updates);
        }
    }

    private function resolvePolicy(Conversation $conversation): ?SlaPolicy
    {
        if ($conversation->sla_policy_id) {
            return SlaPolicy::query()->find($conversation->sla_policy_id);
        }

        return SlaPolicy::query()
            ->where('account_id', $conversation->account_id)
            ->orderBy('id')
            ->first();
    }

    private function addBusinessMinutes(Carbon $from, int $minutes, SlaPolicy $policy): Carbon
    {
        if (! $policy->only_during_business_hours) {
            return $from->copy()->addMinutes($minutes);
        }

        $hours = is_array($policy->business_hours) ? $policy->business_hours : [];
        $startHour = (int) ($hours['start'] ?? 9);
        $endHour = (int) ($hours['end'] ?? 17);
        $days = $hours['days'] ?? [1, 2, 3, 4, 5]; // Mon–Fri

        $cursor = $from->copy();
        $remaining = max(1, $minutes);

        // Cap iterations to avoid runaway loops
        for ($guard = 0; $guard < 20000 && $remaining > 0; $guard++) {
            $dow = (int) $cursor->dayOfWeekIso; // 1=Mon … 7=Sun
            if (! in_array($dow, $days, true)) {
                $cursor->addDay()->setTime($startHour, 0, 0);

                continue;
            }

            $windowStart = $cursor->copy()->setTime($startHour, 0, 0);
            $windowEnd = $cursor->copy()->setTime($endHour, 0, 0);

            if ($cursor->lt($windowStart)) {
                $cursor = $windowStart;
            }

            if ($cursor->gte($windowEnd)) {
                $cursor->addDay()->setTime($startHour, 0, 0);

                continue;
            }

            $available = max(0, (int) $windowEnd->diffInMinutes($cursor));
            if ($available <= 0) {
                $cursor->addDay()->setTime($startHour, 0, 0);

                continue;
            }

            if ($remaining <= $available) {
                return $cursor->copy()->addMinutes($remaining);
            }

            $remaining -= $available;
            $cursor->addDay()->setTime($startHour, 0, 0);
        }

        return $from->copy()->addMinutes($minutes);
    }
}
