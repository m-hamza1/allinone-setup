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

type Sla = {
  id: number;
  name: string;
  first_response_minutes: number;
  resolution_minutes: number;
  only_during_business_hours?: boolean;
};

export default function SlaSettingsPage() {
  const { token } = useAdminToken();
  const [items, setItems] = useState<Sla[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Priority SLA");
  const [first, setFirst] = useState("15");
  const [resolution, setResolution] = useState("1440");
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    const res = await api<{ data: Sla[] }>("/sla-policies", { token });
    setItems(res.data);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      await api("/sla-policies", {
        method: "POST",
        token,
        body: JSON.stringify({
          name,
          first_response_minutes: Number(first),
          resolution_minutes: Number(resolution),
          only_during_business_hours: businessHoursOnly,
          business_hours: { start: 9, end: 17, days: [1, 2, 3, 4, 5] },
        }),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage
      title="SLA policies"
      description="First response + resolution targets, optionally during business hours."
      actions={
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Add SLA policy
        </Button>
      }
    >
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="ui-panel flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-muted-foreground text-sm">
                First {item.first_response_minutes}m · Resolve {item.resolution_minutes}m
                {item.only_during_business_hours ? " · business hours" : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await api(`/sla-policies/${item.id}`, { method: "DELETE", token });
                await load();
              }}
            >
              Delete
            </Button>
          </div>
        ))}
        {!items.length ? (
          <p className="text-muted-foreground py-8 text-center text-sm">No SLA policies yet.</p>
        ) : null}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add SLA policy</SheetTitle>
            <SheetDescription>Set first-response and resolution targets.</SheetDescription>
          </SheetHeader>
          <form onSubmit={onCreate} className="mt-6 space-y-4 px-4 pb-6">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">First response (minutes)</span>
              <Input value={first} onChange={(e) => setFirst(e.target.value)} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Resolution (minutes)</span>
              <Input value={resolution} onChange={(e) => setResolution(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={businessHoursOnly}
                onChange={(e) => setBusinessHoursOnly(e.target.checked)}
              />
              Only during business hours (Mon–Fri 09:00–17:00)
            </label>
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="submit" className="w-full">
              Save policy
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
