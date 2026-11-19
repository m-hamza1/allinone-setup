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

type Attr = { id: number; key: string; label: string; attribute_type: string };

export default function AttributesSettingsPage() {
  const { token } = useAdminToken();
  const [items, setItems] = useState<Attr[]>([]);
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!token) return;
    const res = await api<{ data: Attr[] }>("/custom-attributes", { token });
    setItems(res.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      await api("/custom-attributes", {
        method: "POST",
        token,
        body: JSON.stringify({ label, attribute_type: type }),
      });
      setLabel("");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage
      title="Custom attributes"
      description="Extra contact fields, Chatwoot-style."
      actions={
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Add attribute
        </Button>
      }
    >
      {error && !open ? <p className="text-danger mb-3 text-sm">{error}</p> : null}
      <div className="ui-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted-foreground text-left">
            <tr>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-4 py-3">{item.label}</td>
                <td className="px-4 py-3 font-mono text-xs">{item.key}</td>
                <td className="px-4 py-3">{item.attribute_type}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await api(`/custom-attributes/${item.id}`, { method: "DELETE", token });
                      await load();
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add attribute</SheetTitle>
            <SheetDescription>Shown on contact profiles in the inbox.</SheetDescription>
          </SheetHeader>
          <form onSubmit={onCreate} className="mt-6 space-y-4 px-4 pb-6">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Label</span>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Type</span>
              <select
                className="border-border h-9 w-full rounded-[3px] border bg-white px-3 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="link">Link</option>
                <option value="list">List</option>
              </select>
            </label>
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="submit" className="w-full">
              Save
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
