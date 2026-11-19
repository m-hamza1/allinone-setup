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

type Rule = {
  id: number;
  name: string;
  event: string;
  active: boolean;
  conditions?: Record<string, unknown> | Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
};

type LabelRow = { id: number; title: string };
type InboxRow = { id: number; name: string; channel: string };
type AgentRow = { id: number; name: string };

const EVENTS = [
  { value: "conversation_created", label: "Conversation created" },
  { value: "message_created", label: "Message created" },
  { value: "conversation_resolved", label: "Conversation resolved" },
  { value: "conversation_opened", label: "Conversation opened" },
  { value: "conversation_assigned", label: "Conversation assigned" },
] as const;

const ACTION_TYPES = [
  { value: "assign", label: "Assign staff" },
  { value: "label", label: "Add label" },
  { value: "status", label: "Change status" },
  { value: "priority", label: "Set priority" },
  { value: "private_note", label: "Add private note" },
] as const;

const selectClass =
  "border-input bg-background h-9 w-full rounded-[3px] border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function AutomationsPage() {
  const { token } = useAdminToken();
  const [items, setItems] = useState<Rule[]>([]);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [inboxes, setInboxes] = useState<InboxRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [name, setName] = useState("");
  const [event, setEvent] = useState<string>("conversation_created");
  const [condStatus, setCondStatus] = useState("");
  const [condChannel, setCondChannel] = useState("");
  const [condInboxId, setCondInboxId] = useState("");
  const [condUnassigned, setCondUnassigned] = useState(false);
  const [actionType, setActionType] = useState<string>("assign");
  const [assignMode, setAssignMode] = useState<"round_robin" | "agent">("round_robin");
  const [assigneeId, setAssigneeId] = useState("");
  const [labelId, setLabelId] = useState("");
  const [statusValue, setStatusValue] = useState("open");
  const [priorityValue, setPriorityValue] = useState("high");
  const [noteBody, setNoteBody] = useState("");

  async function load() {
    if (!token) return;
    const [rulesRes, labelsRes, inboxesRes, agentsRes] = await Promise.all([
      api<{ data: Rule[] }>("/automations", { token }),
      api<{ data: LabelRow[] }>("/labels", { token }).catch(() => ({ data: [] as LabelRow[] })),
      api<{ data: InboxRow[] }>("/inboxes", { token }).catch(() => ({ data: [] as InboxRow[] })),
      api<{ data: AgentRow[] }>("/agents", { token }).catch(() => ({ data: [] as AgentRow[] })),
    ]);
    setItems(rulesRes.data);
    setLabels(labelsRes.data ?? []);
    setInboxes(inboxesRes.data ?? []);
    setAgents(agentsRes.data ?? []);
  }

  useEffect(() => {
    if (!token) return;
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setHasLoaded(true));
  }, [token]);

  function buildConditions(): Record<string, unknown> {
    const conditions: Record<string, unknown> = {};
    if (condStatus) conditions.status = condStatus;
    if (condChannel) conditions.channel = condChannel;
    if (condInboxId) conditions.inbox_id = Number(condInboxId);
    if (condUnassigned) conditions.unassigned = true;
    return conditions;
  }

  function buildActions(): Array<Record<string, unknown>> {
    if (actionType === "assign") {
      return [
        {
          type: "assign",
          assignee: assignMode === "round_robin" ? "round_robin" : Number(assigneeId),
        },
      ];
    }
    if (actionType === "label") {
      return [{ type: "label", label_id: Number(labelId) }];
    }
    if (actionType === "status") {
      return [{ type: "status", status: statusValue }];
    }
    if (actionType === "priority") {
      return [{ type: "priority", priority: priorityValue }];
    }
    return [{ type: "private_note", body: noteBody || "Automation note" }];
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await api("/automations", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name || `${EVENTS.find((x) => x.value === event)?.label ?? event} rule`,
          event,
          active: true,
          conditions: buildConditions(),
          actions: buildActions(),
        }),
      });
      setName("");
      setDrawerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule: Rule) {
    if (!token) return;
    await api(`/automations/${rule.id}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ active: !rule.active }),
    });
    await load();
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage
      title="Automations"
      description="Build rules that run on conversation events — assign, label, status, priority, notes."
      actions={
        <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
          Create rule
        </Button>
      }
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={4} />
      ) : (
        <div className="space-y-3">
          {error && !drawerOpen ? <p className="text-danger text-sm">{error}</p> : null}
          <ul className="border-border bg-surface divide-y overflow-hidden rounded-[3px] border">
            {items.map((rule) => (
              <li key={rule.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {EVENTS.find((e) => e.value === rule.event)?.label ?? rule.event}
                    {" · "}
                    {rule.active ? "active" : "paused"}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    when {JSON.stringify(rule.conditions ?? {})} →{" "}
                    {JSON.stringify(rule.actions ?? [])}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleActive(rule)}>
                    {rule.active ? "Pause" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await api(`/automations/${rule.id}`, { method: "DELETE", token });
                      await load();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
            {!items.length ? (
              <li className="text-muted-foreground px-4 py-8 text-center text-sm">
                No automation rules yet — create one from the drawer.
              </li>
            ) : null}
          </ul>
        </div>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create automation</SheetTitle>
            <SheetDescription>Event → conditions → action.</SheetDescription>
          </SheetHeader>
          <form onSubmit={onCreate} className="mt-6 space-y-4 px-4 pb-6">
            <div className="grid gap-3">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Rule name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto-assign new email chats"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Event</span>
                <select
                  className={selectClass}
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                >
                  {EVENTS.map((ev) => (
                    <option key={ev.value} value={ev.value}>
                      {ev.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Conditions
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <select
                    className={selectClass}
                    value={condStatus}
                    onChange={(e) => setCondStatus(e.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="open">Open</option>
                    <option value="resolved">Resolved</option>
                    <option value="pending">Pending</option>
                    <option value="snoozed">Snoozed</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Channel</span>
                  <select
                    className={selectClass}
                    value={condChannel}
                    onChange={(e) => setCondChannel(e.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="website">Website</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="sms">SMS</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Inbox</span>
                  <select
                    className={selectClass}
                    value={condInboxId}
                    onChange={(e) => setCondInboxId(e.target.value)}
                  >
                    <option value="">Any</option>
                    {inboxes.map((inbox) => (
                      <option key={inbox.id} value={inbox.id}>
                        {inbox.name} ({inbox.channel})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={condUnassigned}
                    onChange={(e) => setCondUnassigned(e.target.checked)}
                    className="size-4 rounded border"
                  />
                  <span>Only unassigned</span>
                </label>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Action
              </p>
              <div className="grid gap-3">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Type</span>
                  <select
                    className={selectClass}
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                  >
                    {ACTION_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>

                {actionType === "assign" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm">
                      <span className="text-muted-foreground">Assign mode</span>
                      <select
                        className={selectClass}
                        value={assignMode}
                        onChange={(e) =>
                          setAssignMode(e.target.value as "round_robin" | "agent")
                        }
                      >
                        <option value="round_robin">Round robin</option>
                        <option value="agent">Specific staff</option>
                      </select>
                    </label>
                    {assignMode === "agent" ? (
                      <label className="space-y-1.5 text-sm">
                        <span className="text-muted-foreground">Staff</span>
                        <select
                          className={selectClass}
                          value={assigneeId}
                          onChange={(e) => setAssigneeId(e.target.value)}
                          required
                        >
                          <option value="">Select…</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                ) : null}

                {actionType === "label" ? (
                  <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Label</span>
                    <select
                      className={selectClass}
                      value={labelId}
                      onChange={(e) => setLabelId(e.target.value)}
                      required
                    >
                      <option value="">Select…</option>
                      {labels.map((label) => (
                        <option key={label.id} value={label.id}>
                          {label.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {actionType === "status" ? (
                  <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">New status</span>
                    <select
                      className={selectClass}
                      value={statusValue}
                      onChange={(e) => setStatusValue(e.target.value)}
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="snoozed">Snoozed</option>
                    </select>
                  </label>
                ) : null}

                {actionType === "priority" ? (
                  <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Priority</span>
                    <select
                      className={selectClass}
                      value={priorityValue}
                      onChange={(e) => setPriorityValue(e.target.value)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                ) : null}

                {actionType === "private_note" ? (
                  <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Note</span>
                    <Input
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      placeholder="Internal note added by automation"
                    />
                  </label>
                ) : null}
              </div>
            </div>

            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving…" : "Create rule"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
