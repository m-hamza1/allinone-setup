"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/loading-skeletons";
import { cacheGet, cacheKey, cacheSet } from "@/lib/page-cache";

type Stats = {
  open_conversations: number;
  resolved_conversations: number;
  unassigned_open: number;
  contacts: number;
  inboxes: number;
  staff: number;
};

export default function AdminDashboardPage() {
  const { token, user } = useAuth({
    roles: ["admin", "super_admin"],
  });
  const cacheId = token ? cacheKey(token, "admin-stats") : "admin-stats";
  const cached = token ? cacheGet<Stats>(cacheId) : null;
  const [stats, setStats] = useState<Stats | null>(() => cached);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(cached));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{ data: Stats }>("/dashboard/stats", { token, timeoutMs: 8000 })
      .then((res) => {
        if (!cancelled) {
          setStats(res.data);
          cacheSet(cacheKey(token, "admin-stats"), res.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stats");
        }
      })
      .finally(() => {
        if (!cancelled) setHasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return null;

  const waitingForData = !hasLoaded && !stats;

  const primary = [
    { label: "Open chats", value: stats?.open_conversations, hint: "Needs attention now" },
    { label: "Unassigned", value: stats?.unassigned_open, hint: "Waiting for an owner" },
    { label: "Resolved", value: stats?.resolved_conversations, hint: "Closed conversations" },
  ];

  const secondary = [
    { label: "Contacts", value: stats?.contacts },
    { label: "Inboxes", value: stats?.inboxes },
    { label: "Team", value: stats?.staff },
  ];

  return waitingForData ? (
    <DashboardSkeleton />
  ) : (
    <div className="h-full overflow-y-auto p-6">
          <div className="w-full space-y-8">
            <section>
              <p className="text-muted-foreground mb-2 text-xs tracking-[0.18em] uppercase">
                Overview
              </p>
              <h1 className="font-[family-name:var(--font-display)] mb-2 text-4xl">
                {user?.account?.name ?? "Workspace"}
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Monitor support load, manage your team, and keep website inboxes ready.
              </p>
            </section>

            {error ? <p className="text-danger text-sm">{error}</p> : null}

            <section className="grid gap-4 md:grid-cols-3">
              {primary.map((item) => (
                <div
                  key={item.label}
                  className="ui-panel border-l-primary border-l-4 p-5 shadow-[var(--shadow)]"
                >
                  <p className="text-muted-foreground mb-3 text-sm">{item.label}</p>
                  <p className="font-[family-name:var(--font-display)] mb-2 text-4xl leading-none">
                    {item.value ?? "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">{item.hint}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="ui-panel p-5 shadow-[var(--shadow)]">
                <h2 className="mb-4 text-lg font-medium">Quick actions</h2>
                <div className="space-y-3">
                  <Button asChild variant="outline" className="h-auto w-full justify-start px-4 py-3">
                    <Link href="/admin/team">
                      <span className="text-left">
                        <span className="block font-medium">Add staff or admin</span>
                        <span className="text-muted-foreground block text-sm font-normal">
                          Create users who can work the inbox.
                        </span>
                      </span>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-auto w-full justify-start px-4 py-3">
                    <Link href="/admin/inboxes">
                      <span className="text-left">
                        <span className="block font-medium">Configure website inbox</span>
                        <span className="text-muted-foreground block text-sm font-normal">
                          Copy widget tokens for the user chat.
                        </span>
                      </span>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-auto w-full justify-start px-4 py-3">
                    <Link href="/staff/inbox">
                      <span className="text-left">
                        <span className="block font-medium">Jump to staff inbox</span>
                        <span className="text-muted-foreground block text-sm font-normal">
                          Handle live conversations yourself.
                        </span>
                      </span>
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="ui-panel p-5 shadow-[var(--shadow)]">
                <h2 className="mb-4 text-lg font-medium">Account pulse</h2>
                <ul className="space-y-4">
                  {secondary.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-muted-foreground text-sm">{item.label}</span>
                      <span className="font-[family-name:var(--font-display)] text-xl">
                        {item.value ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </div>
  );
}
