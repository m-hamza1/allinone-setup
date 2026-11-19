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

type Settings = {
  id: number;
  name: string;
  slug: string;
  settings: {
    timezone?: string;
    brand_color?: string;
    reply_greeting?: string;
    widget_title?: string;
    widget_tagline?: string;
    enable_csat?: boolean;
  };
};

export default function AccountSettingsPage() {
  const { token } = useAdminToken();
  const [data, setData] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setHasLoaded(false);
    api<{ data: Settings }>("/account/settings", { token, timeoutMs: 8000 })
      .then((res) => {
        if (!cancelled) setData(res.data);
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
  }, [token]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token || !data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ data: Settings }>("/account/settings", {
        method: "PUT",
        token,
        body: JSON.stringify({ name: data.name, settings: data.settings }),
      });
      setData(res.data);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage
      title="Account"
      description="Brand and workspace defaults used across staff and widget."
      actions={
        data ? (
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            Configure
          </Button>
        ) : null
      }
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={3} />
      ) : !data ? (
        <p className="text-danger text-sm">{error ?? "Could not load account settings."}</p>
      ) : (
        <article className="border-border bg-surface rounded-[3px] border p-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Account</dt>
              <dd className="font-medium">{data.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Timezone</dt>
              <dd>{data.settings.timezone || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Brand color</dt>
              <dd className="flex items-center gap-2">
                <span
                  className="size-3 rounded-sm border border-black/10"
                  style={{ backgroundColor: data.settings.brand_color ?? "#0f6e56" }}
                />
                {data.settings.brand_color ?? "#0f6e56"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">CSAT</dt>
              <dd>{data.settings.enable_csat ? "Enabled" : "Off"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs">Widget</dt>
              <dd>
                {data.settings.widget_title || "—"}
                {data.settings.widget_tagline
                  ? ` · ${data.settings.widget_tagline}`
                  : ""}
              </dd>
            </div>
          </dl>
        </article>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Configure account</SheetTitle>
            <SheetDescription>Brand, timezone, widget, and CSAT defaults.</SheetDescription>
          </SheetHeader>
          {data ? (
            <form onSubmit={onSave} className="mt-6 space-y-4 px-4 pb-6">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Account name</span>
                <Input
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Timezone</span>
                <Input
                  value={data.settings.timezone ?? ""}
                  onChange={(e) =>
                    setData({
                      ...data,
                      settings: { ...data.settings, timezone: e.target.value },
                    })
                  }
                  placeholder="Asia/Karachi"
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Brand color</span>
                <Input
                  value={data.settings.brand_color ?? "#0f6e56"}
                  onChange={(e) =>
                    setData({
                      ...data,
                      settings: { ...data.settings, brand_color: e.target.value },
                    })
                  }
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Widget title</span>
                <Input
                  value={data.settings.widget_title ?? ""}
                  onChange={(e) =>
                    setData({
                      ...data,
                      settings: { ...data.settings, widget_title: e.target.value },
                    })
                  }
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Widget tagline</span>
                <Input
                  value={data.settings.widget_tagline ?? ""}
                  onChange={(e) =>
                    setData({
                      ...data,
                      settings: { ...data.settings, widget_tagline: e.target.value },
                    })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(data.settings.enable_csat)}
                  onChange={(e) =>
                    setData({
                      ...data,
                      settings: { ...data.settings, enable_csat: e.target.checked },
                    })
                  }
                />
                Enable CSAT after resolve
              </label>
              {error ? <p className="text-danger text-sm">{error}</p> : null}
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
