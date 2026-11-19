"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { TablePageSkeleton } from "@/components/loading-skeletons";

/** Chatwoot SettingsWrapper-style centered document page (shell comes from admin layout). */
export function AdminCrudPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { token } = useAuth({ roles: ["admin", "super_admin"] });
  if (!token) {
    return <TablePageSkeleton rows={4} />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full space-y-6 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function useAdminToken() {
  return useAuth({ roles: ["admin", "super_admin"] });
}

export function SimpleListForm({
  token,
  loadPath,
  createPath,
  fields,
  renderItem,
  mapBody,
}: {
  token: string;
  loadPath: string;
  createPath: string;
  fields: Array<{ key: string; placeholder: string; type?: string; required?: boolean }>;
  renderItem: (item: any, onDelete: () => void) => ReactNode;
  mapBody?: (form: Record<string, string>) => unknown;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { api } = await import("@/lib/api");
    const res = await api<{ data: any[] }>(loadPath, { token, timeoutMs: 8000 });
    setItems(res.data);
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
  }, [token, loadPath]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { api } = await import("@/lib/api");
      await api(createPath, {
        method: "POST",
        token,
        body: JSON.stringify(mapBody ? mapBody(form) : form),
      });
      setForm({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(path: string) {
    const { api } = await import("@/lib/api");
    await api(path, { method: "DELETE", token });
    await load();
  }

  if (!hasLoaded && items.length === 0) return <TablePageSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="border-border bg-surface grid gap-3 rounded-[3px] border p-5">
        {fields.map((field) => (
          <input
            key={field.key}
            type={field.type ?? "text"}
            required={field.required}
            value={form[field.key] ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
            className="ui-input"
          />
        ))}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Add"}
        </Button>
      </form>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id}>{renderItem(item, () => onDelete(`${createPath}/${item.id}`))}</div>
        ))}
      </div>
    </div>
  );
}
