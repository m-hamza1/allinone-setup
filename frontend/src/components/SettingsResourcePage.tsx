"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePageSkeleton } from "@/components/loading-skeletons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Field = {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
};

export function SettingsResourcePage({
  title,
  description,
  path,
  fields,
  mapBody,
  renderMeta,
  createLabel = "Add",
}: {
  title: string;
  description: string;
  path: string;
  fields: Field[];
  mapBody?: (form: Record<string, string>) => unknown;
  renderMeta?: (item: any) => ReactNode;
  createLabel?: string;
}) {
  const { token } = useAdminToken();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function load() {
    if (!token) return;
    const res = await api<{ data: any[] }>(path, { token, timeoutMs: 10000 });
    setItems(res.data ?? []);
  }

  useEffect(() => {
    if (!token) return;
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setHasLoaded(true));
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await api(path, {
        method: "POST",
        token,
        body: JSON.stringify(mapBody ? mapBody(form) : form),
      });
      setForm({});
      setDrawerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return <TablePageSkeleton rows={4} />;
  }

  return (
    <AdminCrudPage
      title={title}
      description={description}
      actions={
        <Button type="button" size="sm" onClick={() => { setError(null); setDrawerOpen(true); }}>
          {createLabel}
        </Button>
      }
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={4} />
      ) : (
        <div className="space-y-4">
          {error && !drawerOpen ? <p className="text-danger text-sm">{error}</p> : null}
          <ul className="border-border bg-surface divide-y overflow-hidden rounded-[3px] border">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{item.name ?? item.title ?? `#${item.id}`}</p>
                  {renderMeta ? (
                    <div className="text-muted-foreground text-xs">{renderMeta(item)}</div>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await api(`${path}/${item.id}`, { method: "DELETE", token });
                    await load();
                  }}
                >
                  Delete
                </Button>
              </li>
            ))}
            {!items.length ? (
              <li className="text-muted-foreground px-4 py-8 text-center text-sm">No items yet.</li>
            ) : null}
          </ul>
        </div>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{createLabel}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <form onSubmit={onCreate} className="mt-6 space-y-4 px-4 pb-6">
            {fields.map((field) => (
              <label key={field.key} className="block space-y-1.5 text-sm">
                <span className="font-medium">{field.label}</span>
                <Input
                  type={field.type ?? "text"}
                  required={field.required}
                  value={form[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                />
              </label>
            ))}
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving…" : createLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDrawerOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
