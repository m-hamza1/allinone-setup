"use client";

import { FormEvent, useEffect, useState } from "react";
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

type ViewRow = {
  id: number;
  name: string;
  is_shared?: boolean;
  filters?: { status?: string; assignee?: string };
};

export default function CustomViewsPage() {
  const { token } = useAdminToken();
  const [items, setItems] = useState<ViewRow[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    status: "open",
    assignee: "all",
    is_shared: true,
  });

  async function load() {
    if (!token) return;
    const res = await api<{ data: ViewRow[] }>("/custom-views", { token });
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
      await api("/custom-views", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: form.name,
          is_shared: form.is_shared,
          filters: { status: form.status, assignee: form.assignee },
        }),
      });
      setForm({ name: "", status: "open", assignee: "all", is_shared: true });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage
      title="Custom views"
      description="Saved inbox filters — appear as chips in Conversations."
      actions={
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Add view
        </Button>
      }
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={4} />
      ) : (
        <ul className="border-border bg-surface divide-y overflow-hidden rounded-[3px] border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground text-xs">
                  {(item.filters?.status ?? "open") +
                    " · " +
                    (item.filters?.assignee ?? "all") +
                    (item.is_shared ? " · shared" : " · personal")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await api(`/custom-views/${item.id}`, { method: "DELETE", token });
                  await load();
                }}
              >
                Delete
              </Button>
            </li>
          ))}
          {!items.length ? (
            <li className="text-muted-foreground px-4 py-8 text-center text-sm">No views yet.</li>
          ) : null}
        </ul>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add view</SheetTitle>
            <SheetDescription>Save a filter pack for the inbox list.</SheetDescription>
          </SheetHeader>
          <form onSubmit={onCreate} className="mt-6 space-y-4 px-4 pb-6">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Name</span>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Unassigned open"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Status</span>
              <select
                className="border-border h-9 w-full rounded-[3px] border bg-white px-3 text-sm"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="all">All</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Assignee</span>
              <select
                className="border-border h-9 w-full rounded-[3px] border bg-white px-3 text-sm"
                value={form.assignee}
                onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
              >
                <option value="all">All</option>
                <option value="me">Mine</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_shared}
                onChange={(e) => setForm((f) => ({ ...f, is_shared: e.target.checked }))}
              />
              Share with team
            </label>
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving…" : "Save view"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
