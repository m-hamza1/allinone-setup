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
  settings: Record<string, unknown>;
};

export default function SecuritySettingsPage() {
  const { token } = useAdminToken();
  const [sessionHours, setSessionHours] = useState("720");
  const [require2fa, setRequire2fa] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [samlEnabled, setSamlEnabled] = useState(false);
  const [samlEntity, setSamlEntity] = useState("");
  const [samlUrl, setSamlUrl] = useState("");
  const [account, setAccount] = useState<Settings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<{ data: Settings }>("/account/settings", { token })
      .then((res) => {
        setAccount(res.data);
        const sec = (res.data.settings?.security ?? {}) as Record<string, unknown>;
        const sso = (res.data.settings?.sso ?? {}) as Record<string, unknown>;
        if (sec.session_hours) setSessionHours(String(sec.session_hours));
        setRequire2fa(Boolean(sec.require_2fa));
        setGoogleEnabled(Boolean(sso.google_enabled));
        setSamlEnabled(Boolean(sso.saml_enabled));
        setSamlEntity(String(sso.saml_entity_id ?? ""));
        setSamlUrl(String(sso.saml_sso_url ?? ""));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  }, [token]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token || !account) return;
    setError(null);
    setMessage(null);
    try {
      const settings = {
        ...account.settings,
        security: {
          session_hours: Number(sessionHours) || 720,
          require_2fa: require2fa,
        },
        sso: {
          google_enabled: googleEnabled,
          saml_enabled: samlEnabled,
          saml_entity_id: samlEntity || null,
          saml_sso_url: samlUrl || null,
        },
      };
      const res = await api<{ data: Settings }>("/account/settings", {
        method: "PUT",
        token,
        body: JSON.stringify({ name: account.name, settings }),
      });
      setAccount(res.data);
      setMessage("Security settings saved");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage
      title="Security"
      description="2FA policy, session lifetime, and SSO settings."
      actions={
        <Button type="button" size="sm" onClick={() => setOpen(true)} disabled={!account}>
          Configure
        </Button>
      }
    >
      {error && !open ? <p className="text-danger mb-3 text-sm">{error}</p> : null}
      {message && !open ? <p className="mb-3 text-sm text-emerald-700">{message}</p> : null}

      <article className="border-border bg-surface rounded-[3px] border p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">Session lifetime</dt>
            <dd className="font-medium">{sessionHours} hours</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Require 2FA</dt>
            <dd>{require2fa ? "On" : "Off"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Google SSO</dt>
            <dd>{googleEnabled ? "Enabled" : "Off"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">SAML</dt>
            <dd>{samlEnabled ? "Flagged (not live)" : "Off"}</dd>
          </div>
        </dl>
      </article>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Configure security</SheetTitle>
            <SheetDescription>Sessions, 2FA enforcement, and SSO.</SheetDescription>
          </SheetHeader>
          <form onSubmit={onSave} className="mt-6 space-y-4 px-4 pb-6">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Session lifetime (hours)</span>
              <Input value={sessionHours} onChange={(e) => setSessionHours(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={require2fa}
                onChange={(e) => setRequire2fa(e.target.checked)}
              />
              Require 2FA for staff
            </label>

            <div className="border-border space-y-3 border-t pt-4">
              <p className="text-sm font-medium">SSO</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={googleEnabled}
                  onChange={(e) => setGoogleEnabled(e.target.checked)}
                />
                Allow Google OAuth
              </label>
              <div className="bg-muted/40 space-y-3 rounded-md border border-dashed p-3">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  SAML SSO is stored for future enterprise rollout — login endpoints are
                  not active in this baseline. Prefer Google OAuth when configured.
                </p>
                <label className="flex items-center gap-2 text-sm opacity-70">
                  <input
                    type="checkbox"
                    checked={samlEnabled}
                    onChange={(e) => setSamlEnabled(e.target.checked)}
                  />
                  SAML flagged (not live)
                </label>
                <label className="block space-y-1.5 text-sm opacity-70">
                  <span className="font-medium">SAML entity ID</span>
                  <Input value={samlEntity} onChange={(e) => setSamlEntity(e.target.value)} />
                </label>
                <label className="block space-y-1.5 text-sm opacity-70">
                  <span className="font-medium">SAML SSO URL</span>
                  <Input value={samlUrl} onChange={(e) => setSamlUrl(e.target.value)} />
                </label>
              </div>
            </div>

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
