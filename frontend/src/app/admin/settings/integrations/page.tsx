"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BotIcon,
  CableIcon,
  LanguagesIcon,
  MessageSquareIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TicketIcon,
  VideoIcon,
  WebhookIcon,
} from "lucide-react";
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

type FieldDef = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  optional?: boolean;
};

type Integration = {
  key: string;
  name: string;
  category?: string;
  description?: string;
  enabled: boolean;
  status?: string;
  has_credentials?: boolean;
  credentials?: Record<string, string>;
  fields?: FieldDef[];
};

const ICONS: Record<string, typeof MessageSquareIcon> = {
  slack: MessageSquareIcon,
  dialogflow: BotIcon,
  openai: SparklesIcon,
  google_translate: LanguagesIcon,
  webhooks: WebhookIcon,
  linear: TicketIcon,
  shopify: ShoppingBagIcon,
  dyte: VideoIcon,
};

const ACCENTS: Record<string, string> = {
  slack: "#4A154B",
  dialogflow: "#FF9800",
  openai: "#10a37f",
  google_translate: "#4285F4",
  webhooks: "#0f6e56",
  linear: "#5E6AD2",
  shopify: "#96bf48",
  dyte: "#2160FD",
};

function StatusPill({ enabled, configured }: { enabled: boolean; configured: boolean }) {
  if (enabled && configured) {
    return (
      <span className="bg-accent-soft text-accent-ink inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
        <span className="bg-success size-1.5 rounded-full" />
        Connected
      </span>
    );
  }
  if (configured) {
    return (
      <span className="bg-secondary text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
        Configured
      </span>
    );
  }
  return (
    <span className="bg-secondary text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
      Not connected
    </span>
  );
}

export default function IntegrationsPage() {
  const { token } = useAdminToken();
  const [items, setItems] = useState<Integration[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const active = useMemo(
    () => items.find((item) => item.key === activeKey) ?? null,
    [items, activeKey],
  );

  async function load() {
    if (!token) return;
    const res = await api<{ data: Integration[] }>("/integrations", { token });
    setItems(res.data ?? []);
  }

  useEffect(() => {
    if (!token) return;
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setHasLoaded(true));
  }, [token]);

  function openConfigure(item: Integration) {
    setError(null);
    setActiveKey(item.key);
    const next: Record<string, string> = {};
    for (const field of item.fields ?? []) {
      next[field.key] = item.credentials?.[field.key] ?? "";
    }
    setForm(next);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token || !active) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/integrations/${active.key}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          enabled: true,
          credentials: form,
        }),
      });
      await load();
      setActiveKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setEnabled(item: Integration, enabled: boolean) {
    if (!token) return;
    setError(null);
    try {
      await api(`/integrations/${item.key}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ enabled }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function runTest(item: Integration) {
    if (!token) return;
    setTestingKey(item.key);
    setTestResult(null);
    setError(null);
    try {
      const res = await api<{ data: { ok: boolean; mode: string; detail: string } }>(
        `/integrations/${item.key}/test`,
        { method: "POST", token },
      );
      setTestResult(
        `${item.name}: ${res.data.ok ? "OK" : "Failed"} (${res.data.mode}) — ${res.data.detail}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingKey(null);
    }
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage
      title="Integrations"
      description="Connect apps your team already uses — configure credentials per box."
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={5} />
      ) : (
        <div className="space-y-4">
          {error ? <p className="text-danger text-sm">{error}</p> : null}
          {testResult ? <p className="text-muted-foreground text-sm">{testResult}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const Icon = ICONS[item.key] ?? CableIcon;
              const accent = ACCENTS[item.key] ?? "#0f6e56";
              const configured = Boolean(item.has_credentials);

              return (
                <article
                  key={item.key}
                  className="border-border bg-surface flex flex-col rounded-2xl border p-5 shadow-[var(--shadow-sm,0_1px_2px_rgba(0,0,0,0.04))]"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${accent}18`, color: accent }}
                    >
                      <Icon className="size-5" />
                    </div>
                    <StatusPill enabled={item.enabled} configured={configured} />
                  </div>

                  <div className="mb-4 min-w-0 flex-1 space-y-1">
                    <h2 className="text-base font-medium tracking-tight">{item.name}</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.description ?? item.category ?? "Integration"}
                    </p>
                    <p className="text-muted-foreground text-[11px] capitalize">
                      {item.category}
                    </p>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      onClick={() => openConfigure(item)}
                    >
                      {configured ? "Configure" : "Connect"}
                    </Button>
                    {item.enabled ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={testingKey === item.key}
                          onClick={() => runTest(item)}
                        >
                          {testingKey === item.key ? "Testing…" : "Test"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEnabled(item, false)}
                        >
                          Disable
                        </Button>
                      </>
                    ) : configured ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setEnabled(item, true)}
                      >
                        Enable
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          {!items.length ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              No integrations available.
            </p>
          ) : null}
        </div>
      )}

      <Sheet open={Boolean(active)} onOpenChange={(open) => !open && setActiveKey(null)}>
        <SheetContent side="right" className="sm:max-w-md">
          {active ? (
            <>
              <SheetHeader>
                <SheetTitle>Configure {active.name}</SheetTitle>
                <SheetDescription>
                  {active.description ?? "Save credentials to connect this app."}
                </SheetDescription>
              </SheetHeader>

              <form onSubmit={onSave} className="mt-6 space-y-4 px-4 pb-6">
                {(active.fields ?? []).map((field) => (
                  <label key={field.key} className="block space-y-1.5 text-sm">
                    <span className="font-medium">
                      {field.label}
                      {field.optional ? (
                        <span className="text-muted-foreground font-normal"> (optional)</span>
                      ) : null}
                    </span>
                    {field.type === "textarea" ? (
                      <textarea
                        className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={form[field.key] ?? ""}
                        placeholder={field.placeholder}
                        required={!field.optional}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                      />
                    ) : (
                      <Input
                        type={field.type === "password" ? "password" : "text"}
                        value={form[field.key] ?? ""}
                        placeholder={field.placeholder}
                        required={!field.optional}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                      />
                    )}
                  </label>
                ))}

                {error ? <p className="text-danger text-sm">{error}</p> : null}

                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? "Saving…" : "Save & enable"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveKey(null)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
