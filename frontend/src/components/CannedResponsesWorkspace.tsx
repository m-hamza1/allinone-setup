"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, CannedResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TablePageSkeleton } from "@/components/loading-skeletons";
import { cacheGet, cacheKey, cacheSet } from "@/lib/page-cache";

export function CannedResponsesWorkspace({
  token,
  canManage = true,
}: {
  token: string;
  canManage?: boolean;
}) {
  const key = cacheKey(token, "canned");
  const cached = cacheGet<CannedResponse[]>(key);
  const [items, setItems] = useState<CannedResponse[]>(() => cached ?? []);
  const [form, setForm] = useState({ short_code: "", content: "" });
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(cached));
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await api<{ data: CannedResponse[] }>("/canned-responses", {
      token,
      timeoutMs: 8000,
    });
    setItems(res.data);
    cacheSet(key, res.data);
  }

  useEffect(() => {
    let cancelled = false;
    load()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setHasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError(null);
    try {
      await api("/canned-responses", {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setForm({ short_code: "", content: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    if (!canManage) return;
    await api(`/canned-responses/${id}`, { method: "DELETE", token });
    await load();
  }

  if (!hasLoaded && items.length === 0) return <TablePageSkeleton rows={4} />;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] mb-1 text-3xl">
            Canned replies
          </h1>
          <p className="text-muted-foreground text-sm">
            Quick inserts for common answers — use them from the inbox composer.
          </p>
        </div>

        {canManage ? (
          <form onSubmit={onCreate} className="ui-panel space-y-3 p-5 shadow-[var(--shadow)]">
            <input
              value={form.short_code}
              onChange={(e) => setForm((f) => ({ ...f, short_code: e.target.value }))}
              placeholder="Short code (e.g. hello)"
              className="ui-input"
              required
            />
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Reply content"
              rows={4}
              className="ui-input resize-none"
              required
            />
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add canned reply"}
            </Button>
          </form>
        ) : null}

        {error ? <p className="text-danger text-sm">{error}</p> : null}

        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="ui-panel space-y-2 p-5 shadow-[var(--shadow)]">
              <div className="flex items-start justify-between gap-3">
                <code className="bg-surface-2 rounded px-2 py-1 text-sm">/{item.short_code}</code>
                {canManage ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => onDelete(item.id)}>
                    Delete
                  </Button>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.content}</p>
            </article>
          ))}
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No canned replies yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
