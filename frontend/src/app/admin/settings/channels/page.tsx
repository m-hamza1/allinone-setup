"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AtSignIcon,
  CheckCircle2Icon,
  GlobeIcon,
  HashIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  PlusIcon,
  SendIcon,
  Share2Icon,
  WebhookIcon,
} from "lucide-react";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api, Inbox } from "@/lib/api";
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
import {
  CHANNEL_CATALOG,
  ChannelDefinition,
  ChannelKey,
  channelDef,
} from "@/lib/channel-catalog";

type Channel = {
  id: number;
  provider: string;
  status: string;
  inbox_id?: number | null;
  credentials?: Record<string, string> | null;
  meta?: Record<string, unknown> | null;
  inbox?: { id: number; name: string; channel: string } | null;
};

type Drawer = "none" | "picker" | "setup" | "test";

const ICONS: Record<ChannelKey, typeof GlobeIcon> = {
  website: GlobeIcon,
  email: MailIcon,
  whatsapp: MessageCircleIcon,
  facebook: Share2Icon,
  instagram: AtSignIcon,
  sms: PhoneIcon,
  telegram: SendIcon,
  api: WebhookIcon,
  twitter: HashIcon,
  line: MessageCircleIcon,
};

function StatusPill({ status }: { status: string }) {
  const ok = status === "connected";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        ok ? "bg-accent-soft text-accent-ink" : "bg-secondary text-muted-foreground"
      }`}
    >
      <span className={`size-1.5 rounded-full ${ok ? "bg-success" : "bg-border-strong"}`} />
      {ok ? "Connected" : status === "error" ? "Error" : "Not connected"}
    </span>
  );
}

export default function ChannelsSettingsPage() {
  const { token } = useAdminToken();
  const [items, setItems] = useState<Channel[]>([]);
  const [websiteInboxes, setWebsiteInboxes] = useState<Inbox[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>("none");
  const [selected, setSelected] = useState<ChannelDefinition | null>(null);
  const [inboxName, setInboxName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testChannel, setTestChannel] = useState<Channel | null>(null);
  const [testFrom, setTestFrom] = useState("+15551234567");
  const [testBody, setTestBody] = useState("Hello from a customer");
  const [testEmail, setTestEmail] = useState("customer@example.com");

  async function load() {
    if (!token) return;
    const [ch, ib] = await Promise.all([
      api<{ data: Channel[] }>("/channels", { token }),
      api<{ data: Inbox[] }>("/inboxes", { token }),
    ]);
    setItems(ch.data);
    setWebsiteInboxes(ib.data.filter((i) => i.channel === "website"));
  }

  useEffect(() => {
    if (!token) return;
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setHasLoaded(true));
  }, [token]);

  const connectedRows = useMemo(() => {
    const rows: Array<{
      key: string;
      title: string;
      provider: string;
      status: string;
      subtitle: string;
      connection?: Channel;
      website?: Inbox;
    }> = [];

    for (const inbox of websiteInboxes) {
      rows.push({
        key: `website-${inbox.id}`,
        title: inbox.name,
        provider: "website",
        status: "connected",
        subtitle: "Website widget",
        website: inbox,
      });
    }

    for (const item of items) {
      const def = channelDef(item.provider);
      rows.push({
        key: `ch-${item.id}`,
        title: def?.title ?? item.provider,
        provider: item.provider,
        status: item.status,
        subtitle: item.inbox?.name ? `Inbox · ${item.inbox.name}` : "No inbox linked yet",
        connection: item,
      });
    }

    return rows;
  }, [items, websiteInboxes]);

  function openPicker() {
    setError(null);
    setSelected(null);
    setDrawer("picker");
  }

  function openSetup(def: ChannelDefinition) {
    setSelected(def);
    setInboxName(def.inboxNameDefault);
    const existing = items.find((i) => i.provider === def.key);
    const next: Record<string, string> = {};
    for (const f of def.fields) {
      next[f.key] = String(existing?.credentials?.[f.key] ?? "");
    }
    setFields(next);
    setError(null);
    setDrawer("setup");
  }

  async function ensureInbox(provider: ChannelKey, name: string, existing?: Channel) {
    const linkedId = existing?.inbox_id ?? existing?.inbox?.id ?? null;
    if (linkedId) return linkedId;
    const created = await api<{ data: Inbox }>("/inboxes", {
      method: "POST",
      token: token!,
      body: JSON.stringify({ name, channel: provider }),
    });
    return created.data.id;
  }

  async function onConnect(e: FormEvent) {
    e.preventDefault();
    if (!token || !selected) return;
    setSaving(true);
    setError(null);
    try {
      const name = inboxName.trim() || selected.inboxNameDefault;

      if (selected.key === "website") {
        await api("/inboxes", {
          method: "POST",
          token,
          body: JSON.stringify({ name, channel: "website" }),
        });
      } else {
        const credentials: Record<string, string> = {};
        for (const f of selected.fields) {
          if (fields[f.key]?.trim()) credentials[f.key] = fields[f.key].trim();
          else if (!f.optional) throw new Error(`${f.label} is required`);
        }

        const existing = items.find((i) => i.provider === selected.key);
        const inboxId = await ensureInbox(selected.key, name, existing);

        if (existing) {
          await api(`/channels/${existing.id}`, {
            method: "PUT",
            token,
            body: JSON.stringify({
              credentials,
              status: "connected",
              inbox_id: inboxId,
            }),
          });
        } else {
          await api("/channels", {
            method: "POST",
            token,
            body: JSON.stringify({
              provider: selected.key,
              inbox_id: inboxId,
              status: "connected",
              credentials,
            }),
          });
        }
      }

      await load();
      setDrawer("none");
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect channel");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect(item: Channel) {
    if (!token) return;
    await api(`/channels/${item.id}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ status: "disconnected" }),
    });
    await load();
  }

  async function runTest() {
    if (!token || !testChannel) return;
    setError(null);
    try {
      if (testChannel.provider === "email") {
        await api("/channels/email/ingest", {
          method: "POST",
          token,
          body: JSON.stringify({
            from_email: testEmail,
            from_name: "Test customer",
            subject: "Support request",
            body: testBody,
          }),
        });
      } else {
        await api(`/channels/${testChannel.provider}/ingest`, {
          method: "POST",
          token,
          body: JSON.stringify({
            from: testFrom,
            from_name: "Test customer",
            body: testBody,
          }),
        });
      }
      setDrawer("none");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test ingest failed");
    }
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage
      title="Channels"
      description="Connect channels your customers already use — configure in the right drawer."
      actions={
        <Button type="button" size="sm" onClick={openPicker}>
          <PlusIcon /> Add channel
        </Button>
      }
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={6} />
      ) : (
        <div className="space-y-5">
          {connectedRows.length === 0 ? (
            <div className="border-border bg-surface rounded-[3px] border border-dashed px-6 py-16 text-center">
              <CheckCircle2Icon className="text-muted-foreground mx-auto mb-3 size-8 opacity-50" />
              <h2 className="mb-1 text-lg font-medium">No channels yet</h2>
              <p className="text-muted-foreground mx-auto mb-5 max-w-sm text-sm">
                Add Website, Email, WhatsApp, social, SMS, Telegram, or API — configure from the
                drawer.
              </p>
              <Button type="button" onClick={openPicker}>
                <PlusIcon /> Add your first channel
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {connectedRows.map((row) => {
                const Icon = ICONS[(row.provider as ChannelKey) || "website"] ?? GlobeIcon;
                const accent = channelDef(row.provider)?.accent ?? "#0f6e56";
                return (
                  <article
                    key={row.key}
                    className="border-border bg-surface flex flex-col rounded-[3px] border p-5"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div
                        className="flex size-11 shrink-0 items-center justify-center rounded-[3px]"
                        style={{ backgroundColor: `${accent}18`, color: accent }}
                      >
                        <Icon className="size-5" />
                      </div>
                      <StatusPill status={row.status} />
                    </div>
                    <div className="mb-4 min-w-0 flex-1 space-y-1">
                      <h2 className="text-base font-medium tracking-tight">{row.title}</h2>
                      <p className="text-muted-foreground text-sm">{row.subtitle}</p>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
                      {row.website ? (
                        <Button asChild size="sm" variant="outline" className="flex-1">
                          <Link href="/admin/settings/widget">Embed</Link>
                        </Button>
                      ) : null}
                      {row.connection ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const def = channelDef(row.connection!.provider);
                              if (def) openSetup(def);
                            }}
                          >
                            Configure
                          </Button>
                          {row.connection.status === "connected" ? (
                            <>
                              {row.connection.provider === "email" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={async () => {
                                    try {
                                      const res = await api<{
                                        data: Array<{ detail: string; ingested: number }>;
                                      }>("/channels/email/poll", { method: "POST", token });
                                      const total = res.data.reduce((n, r) => n + r.ingested, 0);
                                      setError(
                                        total > 0
                                          ? `IMAP poll ingested ${total} message(s)`
                                          : res.data[0]?.detail ?? "IMAP poll complete",
                                      );
                                    } catch (err) {
                                      setError(
                                        err instanceof Error ? err.message : "IMAP poll failed",
                                      );
                                    }
                                  }}
                                >
                                  Poll
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setTestChannel(row.connection!);
                                  setDrawer("test");
                                }}
                              >
                                Test
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => disconnect(row.connection!)}
                              >
                                Disconnect
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const def = channelDef(row.connection!.provider);
                                if (def) openSetup(def);
                              }}
                            >
                              Connect
                            </Button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {error && drawer === "none" ? <p className="text-danger text-sm">{error}</p> : null}
        </div>
      )}

      {/* Picker drawer */}
      <Sheet open={drawer === "picker"} onOpenChange={(open) => !open && setDrawer("none")}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add channel</SheetTitle>
            <SheetDescription>Choose a channel type to configure.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-3 px-4 pb-6">
            {CHANNEL_CATALOG.map((channel) => {
              const Icon = ICONS[channel.key];
              const existing = items.find((i) => i.provider === channel.key);
              const websiteReady = channel.key === "website" && websiteInboxes.length > 0;
              return (
                <button
                  key={channel.key}
                  type="button"
                  onClick={() => openSetup(channel)}
                  className="border-border hover:bg-surface-2 flex items-start gap-3 rounded-[3px] border p-3 text-left transition-colors"
                >
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-[3px]"
                    style={{ backgroundColor: `${channel.accent}18`, color: channel.accent }}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{channel.title}</p>
                      {(existing?.status === "connected" || websiteReady) && (
                        <span className="text-accent-ink text-[11px]">Connected</span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {channel.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Setup / configure drawer */}
      <Sheet
        open={drawer === "setup" && Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setDrawer("none");
            setSelected(null);
          }
        }}
      >
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>Configure {selected.title}</SheetTitle>
                <SheetDescription>{selected.description}</SheetDescription>
              </SheetHeader>
              <form onSubmit={onConnect} className="mt-6 space-y-4 px-4 pb-6">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Inbox name</span>
                  <Input
                    value={inboxName}
                    onChange={(e) => setInboxName(e.target.value)}
                    placeholder={selected.inboxNameDefault}
                    required
                  />
                </label>

                {selected.fields.map((field) => (
                  <label key={field.key} className="block space-y-1.5 text-sm">
                    <span className="font-medium">
                      {field.label}
                      {field.optional ? (
                        <span className="text-muted-foreground font-normal"> (optional)</span>
                      ) : null}
                    </span>
                    <Input
                      type={field.type ?? "text"}
                      value={fields[field.key] ?? ""}
                      onChange={(e) =>
                        setFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      required={!field.optional && selected.key !== "website"}
                    />
                  </label>
                ))}

                {selected.key === "website" ? (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    After create, open Applications for the embed snippet.
                  </p>
                ) : null}

                {error ? <p className="text-danger text-sm">{error}</p> : null}

                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? "Saving…" : "Save & connect"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDrawer("picker")}
                    disabled={saving}
                  >
                    Back
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Test drawer */}
      <Sheet
        open={drawer === "test"}
        onOpenChange={(open) => {
          if (!open) {
            setDrawer("none");
            setTestChannel(null);
          }
        }}
      >
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Send test message</SheetTitle>
            <SheetDescription>
              Simulates an inbound message on{" "}
              <span className="capitalize">{testChannel?.provider}</span>.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3 px-4 pb-6">
            {testChannel?.provider === "email" ? (
              <Input
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            ) : (
              <Input
                value={testFrom}
                onChange={(e) => setTestFrom(e.target.value)}
                placeholder="From phone / id"
              />
            )}
            <textarea
              className="ui-input min-h-24 resize-none"
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
            />
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="button" onClick={runTest} className="w-full">
              Ingest test message
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
