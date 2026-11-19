"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Macro = {
  id: number;
  name: string;
  visibility: string;
  actions: Array<Record<string, unknown>>;
};

export default function MacrosPage() {
  const { token } = useAdminToken();
  const [items, setItems] = useState<Macro[]>([]);
  const [name, setName] = useState("Resolve with thanks");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    const res = await api<{ data: Macro[] }>("/macros", { token });
    setItems(res.data);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await api("/macros", {
        method: "POST",
        token,
        body: JSON.stringify({
          name,
          visibility: "account",
          actions: [
            { type: "status", status: "resolved" },
            { type: "private_note", body: "Closed via macro" },
          ],
        }),
      });
      setName("Resolve with thanks");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <AdminCrudPage
      title="Macros"
      description="Reusable action packs for inbox conversations."
      actions={
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Add macro
        </Button>
      }
    >
      <ul className="border-border bg-surface divide-y overflow-hidden rounded-[3px] border">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-muted-foreground text-sm">
                {item.actions.map((a) => String(a.type)).join(" → ")}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await api(`/macros/${item.id}`, { method: "DELETE", token });
                await load();
              }}
            >
              Delete
            </Button>
          </li>
        ))}
        {!items.length ? (
          <li className="text-muted-foreground px-4 py-8 text-center text-sm">
            No macros yet.
          </li>
        ) : null}
      </ul>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add macro</SheetTitle>
            <SheetDescription>
              Creates a resolve + private note pack you can run from the inbox.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={onCreate} className="mt-6 space-y-4 px-4 pb-6">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving…" : "Add resolve macro"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
