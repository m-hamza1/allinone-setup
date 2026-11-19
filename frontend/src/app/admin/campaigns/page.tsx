"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api, Inbox, Label } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePageSkeleton } from "@/components/loading-skeletons";

type Campaign = {
  id: number;
  title: string;
  message: string;
  status: string;
  campaign_type: string;
  inbox_id?: number | null;
  audience?: {
    channel?: string;
    label_ids?: number[];
    contact_status?: string;
  } | null;
  inbox?: { id: number; name: string; channel: string } | null;
  launched_at?: string | null;
};

const CHANNELS = [
  { value: "live_chat", label: "Live Chat" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
] as const;

export default function CampaignsPage() {
  const { token } = useAdminToken();
  const [items, setItems] = useState<Campaign[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<string>("live_chat");
  const [campaignType, setCampaignType] = useState<"ongoing" | "one_off">("one_off");
  const [inboxId, setInboxId] = useState("");
  const [labelId, setLabelId] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    const [campaigns, inboxRes, labelRes] = await Promise.all([
      api<{ data: Campaign[] }>("/campaigns", { token }),
      api<{ data: Inbox[] }>("/inboxes", { token }).catch(() => ({ data: [] as Inbox[] })),
      api<{ data: Label[] }>("/labels", { token }).catch(() => ({ data: [] as Label[] })),
    ]);
    setItems(campaigns.data ?? []);
    setInboxes(inboxRes.data ?? []);
    setLabels(labelRes.data ?? []);
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
      await api("/campaigns", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: title || `${CHANNELS.find((c) => c.value === channel)?.label ?? channel} campaign`,
          message,
          campaign_type: campaignType,
          status: "draft",
          inbox_id: inboxId ? Number(inboxId) : null,
          audience: {
            channel,
            label_ids: labelId ? [Number(labelId)] : [],
          },
        }),
      });
      setTitle("");
      setMessage("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (!token) return <TablePageSkeleton rows={5} />;

  return (
    <AdminCrudPage
      title="Campaigns"
      description="One-off or ongoing outreach — Live Chat, WhatsApp, SMS, Email audiences."
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={5} />
      ) : (
        <div className="space-y-6">
          <form
            onSubmit={onCreate}
            className="border-border bg-surface space-y-3 rounded-xl border p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground text-xs">Channel</span>
                <select
                  className="border-border h-9 w-full rounded-md border bg-white px-3 text-sm"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground text-xs">Type</span>
                <select
                  className="border-border h-9 w-full rounded-md border bg-white px-3 text-sm"
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value as "ongoing" | "one_off")}
                >
                  <option value="one_off">One-off</option>
                  <option value="ongoing">Ongoing</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground text-xs">Inbox</span>
                <select
                  className="border-border h-9 w-full rounded-md border bg-white px-3 text-sm"
                  value={inboxId}
                  onChange={(e) => setInboxId(e.target.value)}
                >
                  <option value="">Any / none</option>
                  {inboxes.map((inbox) => (
                    <option key={inbox.id} value={inbox.id}>
                      {inbox.name} ({inbox.channel})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground text-xs">Audience label</span>
                <select
                  className="border-border h-9 w-full rounded-md border bg-white px-3 text-sm"
                  value={labelId}
                  onChange={(e) => setLabelId(e.target.value)}
                >
                  <option value="">All contacts</option>
                  {labels.map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Campaign title"
            />
            <textarea
              className="border-border min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message body"
              required
            />
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create campaign"}
            </Button>
          </form>

          <ul className="border-border bg-surface divide-y overflow-hidden rounded-xl border">
            {items.map((item) => {
              const audienceChannel =
                item.audience?.channel ??
                item.inbox?.channel ??
                (CHANNELS.some((c) => c.value === item.campaign_type)
                  ? item.campaign_type
                  : null);
              return (
                <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground line-clamp-2 text-sm">{item.message}</p>
                    <p className="text-muted-foreground text-xs">
                      {(audienceChannel ?? "channel").toString()} · {item.campaign_type} ·{" "}
                      {item.status}
                      {item.inbox ? ` · ${item.inbox.name}` : ""}
                      {item.audience?.label_ids?.length
                        ? ` · ${item.audience.label_ids.length} label filter`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {item.status !== "disabled" ? (
                      <Button
                        size="sm"
                        onClick={async () => {
                          const res = await api<{
                            delivery?: { sent: number; failed: number; skipped: number };
                          }>(`/campaigns/${item.id}/launch`, { method: "POST", token });
                          if (res.delivery) {
                            window.alert(
                              `Sent ${res.delivery.sent} · failed ${res.delivery.failed} · skipped ${res.delivery.skipped}`,
                            );
                          }
                          await load();
                        }}
                      >
                        {item.status === "completed" ? "Relaunch" : "Launch"}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await api(`/campaigns/${item.id}`, { method: "DELETE", token });
                        await load();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
            {!items.length ? (
              <li className="text-muted-foreground px-4 py-8 text-center text-sm">
                No campaigns yet.
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </AdminCrudPage>
  );
}
