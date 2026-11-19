"use client";

import { useEffect, useState } from "react";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api } from "@/lib/api";
import { DashboardSkeleton } from "@/components/loading-skeletons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Report = {
  range_days: number;
  open: number;
  resolved: number;
  unassigned: number;
  messages_today: number;
  csat_average: number | null;
  csat_count: number;
  csat_distribution: Array<{ score: number; total: number }>;
  by_agent: Array<{
    assignee_id: number;
    name?: string;
    total: number;
    open?: number;
    resolved?: number;
  }>;
  by_inbox: Array<{
    inbox_id: number;
    name?: string;
    channel?: string;
    total: number;
    open?: number;
  }>;
  by_label: Array<{ label_id: number; title: string; color?: string; total: number }>;
  by_team: Array<{ team_id: number; name?: string; total: number }>;
  sla: {
    with_policy: number;
    breached_open: number;
    due_soon: number;
    avg_first_reply_minutes: number | null;
  };
  created_series: Array<{ day: string; total: number }>;
};

function BarList({
  rows,
  labelOf,
  valueOf,
  colorOf,
}: {
  rows: Array<Record<string, unknown>>;
  labelOf: (row: Record<string, unknown>) => string;
  valueOf: (row: Record<string, unknown>) => number;
  colorOf?: (row: Record<string, unknown>) => string | undefined;
}) {
  const max = Math.max(...rows.map(valueOf), 1);
  if (!rows.length) {
    return <p className="text-muted-foreground text-sm">No data yet.</p>;
  }
  return (
    <ul className="space-y-3 text-sm">
      {rows.map((row, idx) => {
        const value = valueOf(row);
        const color = colorOf?.(row);
        return (
          <li key={idx} className="space-y-1">
            <div className="flex justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 truncate">
                {color ? (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ) : null}
                {labelOf(row)}
              </span>
              <span className="shrink-0 tabular-nums">{value}</span>
            </div>
            <div className="bg-secondary h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{
                  width: `${(value / max) * 100}%`,
                  backgroundColor: color || undefined,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function ReportsPage() {
  const { token } = useAdminToken();
  const [report, setReport] = useState<Report | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setHasLoaded(false);
    setError(null);
    api<{ data: Report }>(`/reports/overview?days=${days}`, { token, timeoutMs: 12000 })
      .then((res) => {
        if (!cancelled) setReport(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load reports");
          setReport(null);
        }
      })
      .finally(() => {
        if (!cancelled) setHasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey, days]);

  if (!token) return <DashboardSkeleton />;

  return (
    <AdminCrudPage
      title="Reports"
      description="Staff, inboxes, labels, teams, CSAT, and SLA — Chatwoot-style ops metrics."
      actions={
        <div className="flex items-center gap-2">
          <select
            className="border-border h-8 rounded-md border bg-white px-2 text-xs"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button type="button" size="sm" variant="outline" onClick={() => setReloadKey((n) => n + 1)}>
            Refresh
          </Button>
        </div>
      }
    >
      {!hasLoaded ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="ui-panel space-y-3 p-5">
          <p className="text-danger text-sm">{error}</p>
          <Button type="button" onClick={() => setReloadKey((n) => n + 1)}>
            Retry
          </Button>
        </div>
      ) : report ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Open", report.open],
              ["Resolved", report.resolved],
              ["Unassigned", report.unassigned],
              ["Messages today", report.messages_today],
            ].map(([label, value]) => (
              <div key={String(label)} className="border-border bg-surface rounded-xl border p-4">
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="mt-1 text-3xl font-medium tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <Tabs defaultValue="agents">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="agents">Staff</TabsTrigger>
              <TabsTrigger value="inboxes">Inboxes</TabsTrigger>
              <TabsTrigger value="labels">Labels</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="csat">CSAT</TabsTrigger>
              <TabsTrigger value="sla">SLA</TabsTrigger>
            </TabsList>

            <TabsContent value="agents" className="border-border bg-surface mt-4 rounded-xl border p-4">
              <BarList
                rows={report.by_agent as unknown as Array<Record<string, unknown>>}
                labelOf={(r) => String(r.name ?? r.assignee_id)}
                valueOf={(r) => Number(r.total)}
              />
            </TabsContent>

            <TabsContent value="inboxes" className="border-border bg-surface mt-4 rounded-xl border p-4">
              <BarList
                rows={report.by_inbox as unknown as Array<Record<string, unknown>>}
                labelOf={(r) => `${r.name ?? r.inbox_id} (${r.channel ?? "—"})`}
                valueOf={(r) => Number(r.total)}
              />
            </TabsContent>

            <TabsContent value="labels" className="border-border bg-surface mt-4 rounded-xl border p-4">
              <BarList
                rows={report.by_label as unknown as Array<Record<string, unknown>>}
                labelOf={(r) => String(r.title)}
                valueOf={(r) => Number(r.total)}
                colorOf={(r) => (typeof r.color === "string" ? r.color : undefined)}
              />
            </TabsContent>

            <TabsContent value="teams" className="border-border bg-surface mt-4 rounded-xl border p-4">
              <BarList
                rows={report.by_team as unknown as Array<Record<string, unknown>>}
                labelOf={(r) => String(r.name ?? r.team_id)}
                valueOf={(r) => Number(r.total)}
              />
            </TabsContent>

            <TabsContent value="csat" className="border-border bg-surface mt-4 space-y-4 rounded-xl border p-4">
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-muted-foreground text-sm">Average score</p>
                  <p className="text-3xl font-medium tabular-nums">
                    {report.csat_average ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Responses</p>
                  <p className="text-3xl font-medium tabular-nums">{report.csat_count}</p>
                </div>
              </div>
              <BarList
                rows={report.csat_distribution as unknown as Array<Record<string, unknown>>}
                labelOf={(r) => `${r.score} ★`}
                valueOf={(r) => Number(r.total)}
              />
            </TabsContent>

            <TabsContent value="sla" className="border-border bg-surface mt-4 rounded-xl border p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-sm">With SLA policy</p>
                  <p className="text-2xl font-medium tabular-nums">{report.sla.with_policy}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Breached (open)</p>
                  <p className="text-2xl font-medium tabular-nums text-danger">
                    {report.sla.breached_open}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Due in 4h</p>
                  <p className="text-2xl font-medium tabular-nums">{report.sla.due_soon}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Avg first reply</p>
                  <p className="text-2xl font-medium tabular-nums">
                    {report.sla.avg_first_reply_minutes != null
                      ? `${report.sla.avg_first_reply_minutes}m`
                      : "—"}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {report.created_series.length ? (
            <div className="border-border bg-surface rounded-xl border p-4">
              <h2 className="mb-3 text-sm font-medium">
                Conversations created · last {report.range_days} days
              </h2>
              <div className="flex h-28 items-end gap-1">
                {report.created_series.map((point) => {
                  const max = Math.max(...report.created_series.map((p) => p.total), 1);
                  return (
                    <div
                      key={point.day}
                      className="bg-primary/80 hover:bg-primary min-w-0 flex-1 rounded-t"
                      style={{ height: `${Math.max(8, (point.total / max) * 100)}%` }}
                      title={`${point.day}: ${point.total}`}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </AdminCrudPage>
  );
}
