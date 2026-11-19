<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesAccount;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\CsatResponse;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    use AuthorizesAccount;

    public function overview(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->requirePermission($user, 'report_manage');

        $scope = $this->accountScope($user);
        $days = max(1, min(90, (int) $request->query('days', 30)));
        $since = now()->subDays($days);

        $open = Conversation::query()->tap($scope)->where('status', 'open')->count();
        $resolved = Conversation::query()->tap($scope)->where('status', 'resolved')->count();
        $unassigned = Conversation::query()
            ->tap($scope)
            ->where('status', 'open')
            ->whereNull('assignee_id')
            ->count();

        $messagesToday = Message::query()
            ->whereHas('conversation', fn ($q) => $q->tap($scope))
            ->whereDate('created_at', now()->toDateString())
            ->count();

        $csatAvg = CsatResponse::query()->tap($scope)->avg('score');
        $csatCount = CsatResponse::query()->tap($scope)->count();
        $csatDistribution = CsatResponse::query()
            ->tap($scope)
            ->select('score', DB::raw('count(*) as total'))
            ->groupBy('score')
            ->orderBy('score')
            ->get()
            ->map(fn ($row) => [
                'score' => (int) $row->score,
                'total' => (int) $row->total,
            ]);

        $byAgentRows = Conversation::query()
            ->tap($scope)
            ->select(
                'assignee_id',
                DB::raw('count(*) as total'),
                DB::raw("sum(case when status = 'open' then 1 else 0 end) as open_count"),
                DB::raw("sum(case when status = 'resolved' then 1 else 0 end) as resolved_count"),
            )
            ->whereNotNull('assignee_id')
            ->groupBy('assignee_id')
            ->get();
        $agentNames = User::query()
            ->whereIn('id', $byAgentRows->pluck('assignee_id'))
            ->pluck('name', 'id');
        $byAgent = $byAgentRows->map(fn ($row) => [
            'assignee_id' => $row->assignee_id,
            'name' => $agentNames[$row->assignee_id] ?? null,
            'total' => (int) $row->total,
            'open' => (int) $row->open_count,
            'resolved' => (int) $row->resolved_count,
        ]);

        $byInboxRows = Conversation::query()
            ->tap($scope)
            ->select(
                'inbox_id',
                DB::raw('count(*) as total'),
                DB::raw("sum(case when status = 'open' then 1 else 0 end) as open_count"),
            )
            ->groupBy('inbox_id')
            ->get();
        $inboxes = DB::table('inboxes')
            ->whereIn('id', $byInboxRows->pluck('inbox_id'))
            ->get(['id', 'name', 'channel'])
            ->keyBy('id');
        $byInbox = $byInboxRows->map(fn ($row) => [
            'inbox_id' => $row->inbox_id,
            'name' => $inboxes[$row->inbox_id]->name ?? null,
            'channel' => $inboxes[$row->inbox_id]->channel ?? null,
            'total' => (int) $row->total,
            'open' => (int) $row->open_count,
        ]);

        $byLabelRows = DB::table('conversation_label')
            ->join('conversations', 'conversations.id', '=', 'conversation_label.conversation_id')
            ->join('labels', 'labels.id', '=', 'conversation_label.label_id')
            ->when(
                ! $user->isSuperAdmin(),
                fn ($q) => $q->where('conversations.account_id', $user->account_id),
            )
            ->select('labels.id', 'labels.title', 'labels.color', DB::raw('count(*) as total'))
            ->groupBy('labels.id', 'labels.title', 'labels.color')
            ->orderByDesc('total')
            ->get();
        $byLabel = $byLabelRows->map(fn ($row) => [
            'label_id' => $row->id,
            'title' => $row->title,
            'color' => $row->color,
            'total' => (int) $row->total,
        ]);

        $byTeamRows = Conversation::query()
            ->tap($scope)
            ->select('team_id', DB::raw('count(*) as total'))
            ->whereNotNull('team_id')
            ->groupBy('team_id')
            ->get();
        $teams = DB::table('teams')
            ->whereIn('id', $byTeamRows->pluck('team_id'))
            ->pluck('name', 'id');
        $byTeam = $byTeamRows->map(fn ($row) => [
            'team_id' => $row->team_id,
            'name' => $teams[$row->team_id] ?? null,
            'total' => (int) $row->total,
        ]);

        $slaDue = Conversation::query()
            ->tap($scope)
            ->where('status', 'open')
            ->whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', now())
            ->count();
        $slaUpcoming = Conversation::query()
            ->tap($scope)
            ->where('status', 'open')
            ->whereNotNull('sla_due_at')
            ->whereBetween('sla_due_at', [now(), now()->addHours(4)])
            ->count();
        $withSla = Conversation::query()
            ->tap($scope)
            ->whereNotNull('sla_policy_id')
            ->count();

        $firstReplyMinutes = null;
        try {
            $sample = Conversation::query()
                ->tap($scope)
                ->whereNotNull('first_reply_at')
                ->where('created_at', '>=', $since)
                ->limit(300)
                ->get(['created_at', 'first_reply_at']);
            if ($sample->isNotEmpty()) {
                $firstReplyMinutes = $sample->avg(
                    fn ($c) => max(0, $c->created_at->diffInSeconds($c->first_reply_at) / 60),
                );
            }
        } catch (\Throwable) {
            $firstReplyMinutes = null;
        }

        $createdSeries = Conversation::query()
            ->tap($scope)
            ->where('created_at', '>=', $since)
            ->select(DB::raw('DATE(created_at) as day'), DB::raw('count(*) as total'))
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('day')
            ->get()
            ->map(fn ($row) => [
                'day' => (string) $row->day,
                'total' => (int) $row->total,
            ]);

        return response()->json([
            'data' => [
                'range_days' => $days,
                'open' => $open,
                'resolved' => $resolved,
                'unassigned' => $unassigned,
                'messages_today' => $messagesToday,
                'csat_average' => $csatAvg ? round((float) $csatAvg, 2) : null,
                'csat_count' => $csatCount,
                'csat_distribution' => $csatDistribution,
                'by_agent' => $byAgent,
                'by_inbox' => $byInbox,
                'by_label' => $byLabel,
                'by_team' => $byTeam,
                'sla' => [
                    'with_policy' => $withSla,
                    'breached_open' => $slaDue,
                    'due_soon' => $slaUpcoming,
                    'avg_first_reply_minutes' => $firstReplyMinutes !== null
                        ? round((float) $firstReplyMinutes, 1)
                        : null,
                ],
                'created_series' => $createdSeries,
            ],
        ]);
    }
}
