"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { api, Inbox } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { InboxesSkeleton } from "@/components/loading-skeletons";
import { cacheGet, cacheKey, cacheSet } from "@/lib/page-cache";

export default function AdminInboxesPage() {
  const { token } = useAuth({
    roles: ["admin", "super_admin"],
  });
  const cached = token ? cacheGet<Inbox[]>(cacheKey(token, "inboxes")) : null;
  const [inboxes, setInboxes] = useState<Inbox[]>(() => cached ?? []);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(cached));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (auth: string) => {
    const data = await api<{ data: Inbox[] }>("/inboxes", { token: auth, timeoutMs: 8000 });
    const list = data.data ?? [];
    setInboxes(list);
    cacheSet(cacheKey(auth, "inboxes"), list);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    load(token)
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load inboxes");
        }
      })
      .finally(() => {
        if (!cancelled) setHasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, load]);

  async function createInbox(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await api("/inboxes", {
        method: "POST",
        token,
        body: JSON.stringify({ name: name.trim(), channel: "website" }),
      });
      setName("");
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function rotate(id: number) {
    if (!token) return;
    await api(`/inboxes/${id}/rotate-token`, { method: "POST", token });
    await load(token);
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!token) return null;

  const waitingForData = !hasLoaded && inboxes.length === 0;

  return waitingForData ? (
    <InboxesSkeleton />
  ) : (
    <div className="h-full overflow-y-auto p-6">
          <div className="w-full space-y-6">
            <div>
              <h1 className="font-[family-name:var(--font-display)] mb-1 text-3xl">Inboxes</h1>
              <p className="text-muted-foreground text-sm">
                Website channels that power the user chat at `/user`.
              </p>
            </div>

            <form
              onSubmit={createInbox}
              className="ui-panel flex items-end gap-3 p-4 shadow-[var(--shadow)]"
            >
              <label className="flex-1 text-sm">
                New website inbox
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="ui-input mt-1"
                  placeholder="e.g. Marketing site"
                  required
                />
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </form>

            {error ? <p className="text-danger text-sm">{error}</p> : null}

            <div className="space-y-4">
              {inboxes.map((inbox) => (
                <article
                  key={inbox.id}
                  className="ui-panel space-y-4 p-5 shadow-[var(--shadow)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-[family-name:var(--font-display)] text-2xl">
                        {inbox.name}
                      </h2>
                      <p className="text-muted-foreground mt-1 text-sm capitalize">
                        {inbox.channel} · {inbox.conversations_count ?? 0} conversations
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => rotate(inbox.id)}
                    >
                      Rotate token
                    </Button>
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-2 text-xs tracking-[0.14em] uppercase">
                      Widget token
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="bg-surface-2 flex-1 break-all border border-border px-3 py-2 text-sm">
                        {inbox.widget_token}
                      </code>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => copy(inbox.widget_token, `token-${inbox.id}`)}
                      >
                        {copied === `token-${inbox.id}` ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
  );
}
