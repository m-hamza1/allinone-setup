"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, Label } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TablePageSkeleton } from "@/components/loading-skeletons";
import { cacheGet, cacheKey, cacheSet } from "@/lib/page-cache";

export function LabelsWorkspace({ token }: { token: string }) {
  const key = cacheKey(token, "labels");
  const cached = cacheGet<Label[]>(key);
  const [items, setItems] = useState<Label[]>(() => cached ?? []);
  const [form, setForm] = useState({ title: "", color: "#0f6e56", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(cached));
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await api<{ data: Label[] }>("/labels", { token, timeoutMs: 8000 });
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
    setSaving(true);
    setError(null);
    try {
      await api("/labels", {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setForm({ title: "", color: "#0f6e56", description: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    await api(`/labels/${id}`, { method: "DELETE", token });
    await load();
  }

  if (!hasLoaded && items.length === 0) return <TablePageSkeleton rows={4} />;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] mb-1 text-3xl">Labels</h1>
          <p className="text-muted-foreground text-sm">
            Tag conversations so staff can filter and prioritize like Chatwoot.
          </p>
        </div>

        <form
          onSubmit={onCreate}
          className="ui-panel grid gap-3 p-5 shadow-[var(--shadow)] sm:grid-cols-[1fr_120px]"
        >
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Label title"
            className="ui-input sm:col-span-1"
            required
          />
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="ui-input h-10 p-1"
          />
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            className="ui-input sm:col-span-2"
          />
          <Button type="submit" disabled={saving} className="sm:col-span-2">
            {saving ? "Saving…" : "Add label"}
          </Button>
        </form>

        {error ? <p className="text-danger text-sm">{error}</p> : null}

        <div className="ui-panel overflow-hidden shadow-[var(--shadow)]">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.title}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {item.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(item.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
