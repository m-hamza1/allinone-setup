"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TablePageSkeleton } from "@/components/loading-skeletons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type CaptainSettings = {
  enabled?: boolean;
  auto_draft_on_inbound?: boolean;
};

export default function CaptainSettingsPage() {
  const { token } = useAdminToken();
  const [settings, setSettings] = useState<CaptainSettings>({
    enabled: false,
    auto_draft_on_inbound: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<{ data: CaptainSettings }>("/captain/settings", { token })
      .then((res) => setSettings(res.data ?? {}))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setHasLoaded(true));
  }, [token]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ data: CaptainSettings }>("/captain/settings", {
        method: "PUT",
        token,
        body: JSON.stringify(settings),
      });
      setSettings(res.data);
      setMessage("Captain settings saved");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!token) return <TablePageSkeleton rows={3} />;

  return (
    <AdminCrudPage
      title="Captain AI"
      description="Staff assist drafts. Enable OpenAI under Integrations, then turn Captain on."
      actions={
        <Button type="button" size="sm" onClick={() => setOpen(true)} disabled={!hasLoaded}>
          Configure
        </Button>
      }
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={3} />
      ) : (
        <article className="border-border bg-surface rounded-[3px] border p-5">
          {error && !open ? <p className="text-danger mb-3 text-sm">{error}</p> : null}
          {message && !open ? <p className="mb-3 text-sm text-emerald-700">{message}</p> : null}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Captain</dt>
              <dd className="font-medium">{settings.enabled ? "Enabled" : "Off"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Auto draft on inbound</dt>
              <dd>{settings.auto_draft_on_inbound ? "On" : "Off"}</dd>
            </div>
          </dl>
        </article>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Configure Captain</SheetTitle>
            <SheetDescription>Uses OpenAI credentials from Integrations.</SheetDescription>
          </SheetHeader>
          <form onSubmit={onSave} className="mt-6 space-y-4 px-4 pb-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(settings.enabled)}
                onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
              />
              Enable Captain AI drafts
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(settings.auto_draft_on_inbound)}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, auto_draft_on_inbound: e.target.checked }))
                }
              />
              Auto-post private draft note on inbound messages
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
