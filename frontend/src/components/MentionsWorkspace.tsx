"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Conversation, User } from "@/lib/api";
import { InboxSkeleton } from "@/components/loading-skeletons";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function MentionsWorkspace({
  token,
  user,
}: {
  token: string;
  user: User | null;
}) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ data: Conversation[] }>("/conversations/mentions", { token, timeoutMs: 8000 })
      .then((res) => {
        if (!cancelled) setItems(res.data ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setHasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!hasLoaded) return <InboxSkeleton />;

  return (
    <div className="bg-surface flex h-full min-h-0 flex-col">
      <div className="border-border flex h-12 items-center justify-between gap-3 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="size-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-medium">Mentions</h1>
            <p className="text-muted-foreground truncate text-[11px]">
              Conversations where you were @mentioned
              {user?.name ? ` · ${user.name}` : ""}
            </p>
          </div>
        </div>
        <span className="bg-secondary shrink-0 rounded-full px-2 py-0.5 text-[11px] tabular-nums">
          {items.length}
        </span>
      </div>
      {error ? <p className="text-danger px-4 py-2 text-sm">{error}</p> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">No mentions yet.</p>
        ) : (
          items.map((c) => (
            <Link
              key={c.id}
              href="/staff/inbox"
              className="border-border hover:bg-surface-2 block border-b px-4 py-3"
            >
              <p className="text-sm font-medium">{c.contact?.name ?? "Visitor"}</p>
              <p className="text-muted-foreground truncate text-xs">
                {c.latest_message?.body ?? `Conversation #${c.id}`}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
