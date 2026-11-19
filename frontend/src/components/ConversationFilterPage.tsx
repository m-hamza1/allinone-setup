"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Conversation } from "@/lib/api";
import { InboxSkeleton } from "@/components/loading-skeletons";

export function ConversationFilterPage({
  token,
  title,
  description,
  query,
}: {
  token: string;
  title: string;
  description: string;
  query: string;
}) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ data: Conversation[] }>(`/conversations?${query}`, { token, timeoutMs: 10000 })
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
  }, [token, query]);

  if (!hasLoaded) return <InboxSkeleton />;

  return (
    <div className="bg-surface flex h-full min-h-0 flex-col">
      <div className="border-border flex h-12 items-center justify-between border-b px-4">
        <div>
          <h1 className="text-sm font-medium">{title}</h1>
          <p className="text-muted-foreground text-[11px]">{description}</p>
        </div>
        <span className="bg-secondary rounded-full px-2 py-0.5 text-[11px]">{items.length}</span>
      </div>
      {error ? <p className="text-danger px-4 py-2 text-sm">{error}</p> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">Nothing here yet.</p>
        ) : (
          items.map((c) => (
            <Link
              key={c.id}
              href="/staff/inbox"
              className="border-border hover:bg-surface-2 block border-b px-4 py-3"
            >
              <p className="text-sm font-medium">{c.contact?.name ?? "Visitor"}</p>
              <p className="text-muted-foreground truncate text-xs">
                {c.latest_message?.body ?? `#${c.id} · ${c.status}`}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
