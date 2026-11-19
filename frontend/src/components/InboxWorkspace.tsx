"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  CannedResponse,
  Conversation,
  CustomView,
  Label,
  Macro,
  Message,
  TeamMember,
  User,
} from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { InboxSkeleton } from "@/components/loading-skeletons";
import { cacheGet, cacheKey, cacheSet } from "@/lib/page-cache";
import { getEcho } from "@/lib/echo";

type AssigneeFilter = "all" | "me" | "unassigned";

type InboxCache = {
  conversations: Conversation[];
  team: TeamMember[];
  labels: Label[];
  canned: CannedResponse[];
  macros?: Macro[];
  views?: CustomView[];
};

type BootstrapPayload = {
  conversations: Conversation[];
  team: TeamMember[];
  labels: Label[];
  canned: CannedResponse[];
  macros: Macro[];
  views: CustomView[];
};

export function InboxWorkspace({
  token,
  user,
  userChatHint = "/user",
}: {
  token: string;
  user: User | null;
  userChatHint?: string;
}) {
  const inboxKey = cacheKey(token, "inbox");
  const cached = cacheGet<InboxCache>(inboxKey);

  const [conversations, setConversations] = useState<Conversation[]>(
    () => cached?.conversations ?? [],
  );
  const [team, setTeam] = useState<TeamMember[]>(() => cached?.team ?? []);
  const [labels, setLabels] = useState<Label[]>(() => cached?.labels ?? []);
  const [canned, setCanned] = useState<CannedResponse[]>(() => cached?.canned ?? []);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [reply, setReply] = useState("");
  const [privateNote, setPrivateNote] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [labelFilter, setLabelFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(cached));
  const [macros, setMacros] = useState<Macro[]>(() => cached?.macros ?? []);
  const [views, setViews] = useState<CustomView[]>(() => cached?.views ?? []);
  const [activeViewId, setActiveViewId] = useState<number | "default">("default");
  const [files, setFiles] = useState<File[]>([]);
  const [, setEchoLive] = useState(false);
  const [showContact, setShowContact] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const lastMessageIdRef = useRef<number | null>(null);

  const listQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (assigneeFilter === "me") params.set("assignee", "me");
    if (assigneeFilter === "unassigned") params.set("assignee", "unassigned");
    if (labelFilter) params.set("label_id", labelFilter);
    if (search.trim()) params.set("search", search.trim());
    const qs = params.toString() ? `?${params}` : "";
    return `/conversations${qs}`;
  }, [statusFilter, assigneeFilter, labelFilter, search]);

  const persistCache = useCallback(
    (next: Partial<InboxCache> & { conversations: Conversation[] }) => {
      cacheSet<InboxCache>(inboxKey, {
        conversations: next.conversations,
        team: next.team ?? team,
        labels: next.labels ?? labels,
        canned: next.canned ?? canned,
        macros: next.macros ?? macros,
        views: next.views ?? views,
      });
    },
    [inboxKey, team, labels, canned, macros, views],
  );

  const loadConversations = useCallback(async () => {
    const data = await api<{ data: Conversation[] }>(listQuery(), { token, timeoutMs: 8000 });
    const list = data.data ?? [];
    setConversations(list);
    persistCache({ conversations: list });
  }, [token, listQuery, persistCache]);

  const loadConversation = useCallback(
    async (id: number) => {
      const data = await api<{ data: Conversation }>(`/conversations/${id}`, {
        token,
        timeoutMs: 8000,
      });
      setActive(data.data);
      const msgs = data.data.messages ?? [];
      lastMessageIdRef.current = msgs.length ? msgs[msgs.length - 1].id : null;
    },
    [token],
  );

  const bootstrapQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (assigneeFilter === "me") params.set("assignee", "me");
    if (assigneeFilter === "unassigned") params.set("assignee", "unassigned");
    if (labelFilter) params.set("label_id", labelFilter);
    if (search.trim()) params.set("search", search.trim());
    const qs = params.toString() ? `?${params}` : "";
    return `/inbox/bootstrap${qs}`;
  }, [statusFilter, assigneeFilter, labelFilter, search]);

  // One bootstrap round-trip (Chatwoot-style workspace shell).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ data: BootstrapPayload }>(bootstrapQuery(), {
          token,
          timeoutMs: 10000,
        });
        if (cancelled) return;
        const payload = res.data;
        setConversations(payload.conversations ?? []);
        setTeam(payload.team ?? []);
        setLabels(payload.labels ?? []);
        setCanned(payload.canned ?? []);
        setMacros(payload.macros ?? []);
        setViews(payload.views ?? []);
        persistCache({
          conversations: payload.conversations ?? [],
          team: payload.team,
          labels: payload.labels,
          canned: payload.canned,
          macros: payload.macros,
          views: payload.views,
        });
        setHasLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load inbox");
          setHasLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per token
  }, [token]);

  // Filter/search: list only (meta already bootstrapped).
  const filtersReady = useRef(false);
  useEffect(() => {
    if (!hasLoaded) return;
    if (!filtersReady.current) {
      filtersReady.current = true;
      return;
    }
    let cancelled = false;
    loadConversations().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Failed to refresh inbox");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasLoaded, loadConversations]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setActive(null);
      lastMessageIdRef.current = null;
      return;
    }
    loadConversation(selectedId).catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load chat"),
    );
  }, [selectedId, loadConversation]);

  // Soft presence: once on open, then every 60s while tab visible.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const beat = () => {
      if (cancelled || document.hidden) return;
      api(`/conversations/${selectedId}/presence`, { method: "POST", token, timeoutMs: 5000 }).catch(
        () => undefined,
      );
    };
    beat();
    const timer = setInterval(beat, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedId, token]);

  // Realtime first: patch local state from events (no refetch storm).
  useEffect(() => {
    if (!hasLoaded || !user?.account?.id) return;
    const echo = getEcho(token);
    if (!echo) {
      setEchoLive(false);
      return;
    }

    const channelName = `account.${user.account.id}`;
    const channel = echo.private(channelName);

    const onMessage = (payload: { message?: Message }) => {
      const msg = payload?.message;
      if (!msg) return;

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversation_id);
        if (idx < 0) {
          void loadConversations();
          return prev;
        }
        const next = [...prev];
        const row = { ...next[idx], latest_message: msg, last_activity_at: msg.created_at };
        next.splice(idx, 1);
        next.unshift(row);
        return next;
      });

      if (selectedIdRef.current === msg.conversation_id) {
        setActive((prev) => {
          if (!prev || prev.id !== msg.conversation_id) return prev;
          const ids = new Set((prev.messages ?? []).map((m) => m.id));
          if (ids.has(msg.id)) return prev;
          lastMessageIdRef.current = msg.id;
          return { ...prev, messages: [...(prev.messages ?? []), msg] };
        });
      }
    };

    channel.listen(".message.created", onMessage);
    channel.listen(".conversation.updated", () => {
      void loadConversations();
    });

    const connection = echo.connector?.pusher?.connection;
    const subscription = (
      channel as unknown as {
        subscription?: {
          bind: (event: string, cb: () => void) => void;
          unbind: (event: string) => void;
        };
      }
    ).subscription;
    const onSubscribed = () => setEchoLive(true);
    const onSubError = () => setEchoLive(false);
    subscription?.bind("pusher:subscription_succeeded", onSubscribed);
    subscription?.bind("pusher:subscription_error", onSubError);
    connection?.bind("disconnected", onSubError);
    connection?.bind("unavailable", onSubError);
    connection?.bind("failed", onSubError);

    return () => {
      channel.stopListening(".message.created");
      channel.stopListening(".conversation.updated");
      subscription?.unbind("pusher:subscription_succeeded");
      subscription?.unbind("pusher:subscription_error");
      connection?.unbind("disconnected");
      connection?.unbind("unavailable");
      connection?.unbind("failed");
      echo.leave(channelName);
      setEchoLive(false);
    };
  }, [hasLoaded, token, user?.account?.id, loadConversations]);

  // Always sync the open inbox. Socket events are faster when they land;
  // this still picks up widget messages if the private channel is not subscribed.
  useEffect(() => {
    if (!hasLoaded) return;
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (cancelled || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (assigneeFilter === "me") params.set("assignee", "me");
        if (assigneeFilter === "unassigned") params.set("assignee", "unassigned");
        if (labelFilter) params.set("label_id", labelFilter);
        if (search.trim()) params.set("search", search.trim());
        const sel = selectedIdRef.current;
        if (sel) {
          params.set("conversation_id", String(sel));
          if (lastMessageIdRef.current) params.set("after_id", String(lastMessageIdRef.current));
        }
        const data = await api<{
          data: {
            conversations: Conversation[];
            messages: Message[];
            conversation: { status: Conversation["status"]; assignee_id: number | null } | null;
          };
        }>(`/inbox/sync?${params}`, { token, timeoutMs: 10000 });

        if (cancelled) return;
        setConversations(data.data.conversations ?? []);
        persistCache({ conversations: data.data.conversations ?? [] });

        if (sel && data.data.messages?.length) {
          setActive((prev) => {
            if (!prev || prev.id !== sel) return prev;
            const ids = new Set((prev.messages ?? []).map((m) => m.id));
            const fresh = data.data.messages.filter((m) => !ids.has(m.id));
            if (!fresh.length) return prev;
            lastMessageIdRef.current = fresh[fresh.length - 1].id;
            return {
              ...prev,
              status: data.data.conversation?.status ?? prev.status,
              assignee_id: data.data.conversation?.assignee_id ?? prev.assignee_id,
              messages: [...(prev.messages ?? []), ...fresh],
            };
          });
        } else if (sel && data.data.conversation) {
          setActive((prev) =>
            prev && prev.id === sel
              ? {
                  ...prev,
                  status: data.data.conversation!.status,
                  assignee_id: data.data.conversation!.assignee_id,
                }
              : prev,
          );
        }
      } catch {
        /* ignore poll errors */
      } finally {
        inFlight = false;
      }
    };

    // Delay first poll so boot + Echo get the only PHP worker first.
    const bootDelay = setTimeout(() => {
      if (cancelled) return;
      void tick();
      timer = setInterval(tick, 2000);
    }, 1000);

    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(bootDelay);
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    hasLoaded,
    token,
    statusFilter,
    assigneeFilter,
    labelFilter,
    search,
    persistCache,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages?.length]);

  async function onSuggestReply() {
    if (!selectedId || suggesting) return;
    setSuggesting(true);
    setError(null);
    try {
      const res = await api<{
        data: { ok: boolean; suggestion?: string; detail: string };
      }>(`/conversations/${selectedId}/suggest-reply`, {
        method: "POST",
        token,
      });
      if (res.data.ok && res.data.suggestion) {
        setReply(res.data.suggestion);
      } else {
        setError(res.data.detail || "Suggestion unavailable");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suggest failed");
    } finally {
      setSuggesting(false);
    }
  }

  async function onReply(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || (!reply.trim() && files.length === 0)) return;
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("body", reply.trim() || "(attachment)");
      form.append("private", privateNote ? "1" : "0");
      files.forEach((file) => form.append("attachments[]", file));
      const data = await api<{ data: Message }>(`/conversations/${selectedId}/reply`, {
        method: "POST",
        token,
        body: form,
      });
      setReply("");
      setFiles([]);
      setActive((prev) =>
        prev
          ? {
              ...prev,
              status: privateNote ? prev.status : "open",
              messages: [...(prev.messages ?? []), data.data],
            }
          : prev,
      );
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setSending(false);
    }
  }

  function applyView(view: CustomView | null) {
    if (!view) {
      setActiveViewId("default");
      return;
    }
    setActiveViewId(view.id);
    const f = view.filters ?? {};
    if (f.status) setStatusFilter(f.status);
    if (f.assignee) setAssigneeFilter(f.assignee);
    if (f.label_id) setLabelFilter(String(f.label_id));
  }

  async function applyMacro(macroId: number) {
    if (!selectedId) return;
    const data = await api<{ data: Conversation }>(`/macros/${macroId}/apply/${selectedId}`, {
      method: "POST",
      token,
    });
    setActive(data.data);
    await loadConversations();
  }

  async function setStatus(next: "resolved" | "open") {
    if (!selectedId) return;
    const path = next === "resolved" ? "resolve" : "reopen";
    const data = await api<{ data: Conversation }>(`/conversations/${selectedId}/${path}`, {
      method: "POST",
      token,
    });
    setActive((prev) => (prev ? { ...prev, status: data.data.status } : prev));
    await loadConversations();
  }

  async function assign(assigneeId: number | null) {
    if (!selectedId) return;
    const data = await api<{ data: Conversation }>(`/conversations/${selectedId}/assign`, {
      method: "POST",
      token,
      body: JSON.stringify({ assignee_id: assigneeId }),
    });
    setActive((prev) =>
      prev
        ? {
            ...prev,
            assignee: data.data.assignee,
            assignee_id: data.data.assignee?.id ?? null,
          }
        : prev,
    );
    await loadConversations();
  }

  async function toggleLabel(labelId: number) {
    if (!selectedId || !active) return;
    const current = new Set((active.labels ?? []).map((l) => l.id));
    if (current.has(labelId)) current.delete(labelId);
    else current.add(labelId);
    const data = await api<{ data: Conversation }>(`/conversations/${selectedId}/labels`, {
      method: "POST",
      token,
      body: JSON.stringify({ label_ids: Array.from(current) }),
    });
    const nextLabels = data.data.labels ?? [];
    setActive((prev) => (prev ? { ...prev, labels: nextLabels } : prev));
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, labels: nextLabels } : c)),
    );
  }

  function insertCanned(item: CannedResponse) {
    setReply((prev) => (prev ? `${prev.trim()}\n\n${item.content}` : item.content));
  }

  async function updateMeta(patch: Record<string, unknown>) {
    if (!selectedId) return;
    const data = await api<{ data: Conversation }>(`/conversations/${selectedId}/meta`, {
      method: "POST",
      token,
      body: JSON.stringify(patch),
    });
    setActive((prev) => (prev ? { ...prev, ...data.data } : prev));
    await loadConversations();
  }

  // Slash canned: type /code
  useEffect(() => {
    const match = reply.match(/(?:^|\s)\/([a-zA-Z0-9_-]+)$/);
    if (!match) return;
    const hit = canned.find((c) => c.short_code === match[1]);
    if (!hit) return;
    setReply((prev) => prev.replace(/\/[a-zA-Z0-9_-]+$/, hit.content));
  }, [reply, canned]);

  const messages = useMemo(() => {
    const list = active?.messages ?? [];
    const seen = new Set<number>();
    return list.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [active?.messages]);
  const activeLabelIds = new Set((active?.labels ?? []).map((l) => l.id));

  if (!hasLoaded) {
    return <InboxSkeleton />;
  }

  return (
    <div className="bg-surface flex h-full min-h-0 w-full overflow-hidden">
      {/* Conversation list — Chatwoot fixed rail */}
      <aside className="border-border flex w-full min-h-0 shrink-0 flex-col border-r md:w-[340px] 2xl:w-[412px]">
        <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger className="size-7 shrink-0" />
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium">Conversations</h1>
          <span className="bg-secondary text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] tabular-nums">
            {conversations.length}
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "open" | "resolved" | "all")}
            className="border-border h-8 w-[5.5rem] shrink-0 rounded-md border bg-white px-2 text-xs outline-none"
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="border-border space-y-2 border-b px-3 py-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="ui-input h-8 text-sm"
          />
          <Tabs
            value={assigneeFilter}
            onValueChange={(value) => setAssigneeFilter(value as AssigneeFilter)}
          >
            <TabsList className="h-8 w-full">
              <TabsTrigger value="me" className="flex-1 text-xs">
                Mine
              </TabsTrigger>
              <TabsTrigger value="unassigned" className="flex-1 text-xs">
                Unassigned
              </TabsTrigger>
              <TabsTrigger value="all" className="flex-1 text-xs">
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="border-border h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-xs outline-none"
            >
              <option value="">All labels</option>
              {labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.title}
                </option>
              ))}
            </select>
          </div>
          {views.length ? (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={`rounded border px-2 py-0.5 text-[11px] ${
                  activeViewId === "default" ? "bg-primary text-primary-foreground" : ""
                }`}
                onClick={() => applyView(null)}
              >
                Default
              </button>
              {views.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={`rounded border px-2 py-0.5 text-[11px] ${
                    activeViewId === view.id ? "bg-primary text-primary-foreground" : ""
                  }`}
                  onClick={() => applyView(view)}
                >
                  {view.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="text-muted-foreground p-4 text-sm">
              No conversations. Open{" "}
              <a href={userChatHint} className="text-primary underline">
                User chat
              </a>
              .
            </div>
          ) : (
            conversations.map((c) => {
              const name = c.contact?.name ?? "Visitor";
              const initials = name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const when = c.last_activity_at ? new Date(c.last_activity_at) : null;
              const timeLabel = when
                ? when.toDateString() === new Date().toDateString()
                  ? when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : when.toLocaleDateString([], { month: "short", day: "numeric" })
                : "";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full gap-2.5 px-3 py-2.5 text-left ${
                    selectedId === c.id ? "bg-[#eef2f6]" : "hover:bg-[#f8fafc]"
                  }`}
                >
                  <span className="bg-[#dbe4ee] text-[#334155] mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium">
                    {initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{name}</span>
                      <span className="text-muted-foreground shrink-0 text-[10px]">{timeLabel}</span>
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {c.latest_message?.body ?? "No messages yet"}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block truncate text-[10px]">
                      {c.inbox?.name ?? "Inbox"}
                      {c.priority && c.priority !== "none" ? ` · ${c.priority}` : ""}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat pane */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!selectedId ? (
          <div className="text-muted-foreground grid flex-1 place-items-center text-sm">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="border-border bg-surface shrink-0 border-b">
              <div className="flex h-12 items-center gap-3 px-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {active?.contact?.name ?? "Visitor"}
                  </p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {active?.inbox?.name}
                    {active?.assignee ? ` · ${active.assignee.name}` : " · Unassigned"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {active?.status === "open" ? (
                    <Button type="button" size="sm" onClick={() => setStatus("resolved")}>
                      Resolve
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus("open")}
                    >
                      Reopen
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowContact((v) => !v)}
                  >
                    {showContact ? "Hide" : "Contact"}
                  </Button>
                </div>
              </div>
              <div className="border-border flex flex-wrap items-center gap-1.5 border-t px-4 py-2">
                <select
                  value={active?.assignee?.id ?? active?.assignee_id ?? ""}
                  onChange={(e) => assign(e.target.value ? Number(e.target.value) : null)}
                  className="border-border h-8 max-w-[9rem] shrink-0 rounded-md border bg-white px-2 text-xs outline-none"
                >
                  <option value="">Unassigned</option>
                  {team
                    .filter((m) => m.role !== "super_admin")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
                <select
                  value={active?.priority ?? "none"}
                  onChange={(e) => updateMeta({ priority: e.target.value })}
                  className="border-border h-8 w-[6.5rem] shrink-0 rounded-md border bg-white px-2 text-xs outline-none"
                >
                  <option value="none">Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateMeta({
                      snoozed_until: new Date(Date.now() + 3600_000).toISOString(),
                    })
                  }
                >
                  Snooze 1h
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => updateMeta({ muted: !active?.muted })}
                >
                  {active?.muted ? "Unmute" : "Mute"}
                </Button>
                {macros.length ? (
                  <select
                    className="border-border h-8 max-w-[8rem] shrink-0 rounded-md border bg-white px-2 text-xs outline-none"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) applyMacro(Number(e.target.value));
                      e.target.value = "";
                    }}
                  >
                    <option value="">Macro</option>
                    {macros.map((macro) => (
                      <option key={macro.id} value={macro.id}>
                        {macro.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>

            {(active?.active_viewers?.length ||
              (active?.locker && active.locker.id !== user?.id)) && (
              <p className="shrink-0 bg-amber-50 px-4 py-1.5 text-[11px] text-amber-900">
                Viewing:{" "}
                {[
                  ...(active.active_viewers ?? []).map((v) => v.name),
                  active.locker && active.locker.id !== user?.id ? active.locker.name : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[var(--surface-2)] p-4">
              {messages.map((m) => {
                const isNote = m.sender_type === "note" || m.private;
                const mine = m.sender_type === "staff";
                return (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      isNote
                        ? "border border-amber-200 bg-amber-50 text-amber-950"
                        : mine
                          ? "bg-primary text-primary-foreground ml-auto"
                          : "border-border border bg-surface"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.attachments?.length ? (
                      <div className="mt-1 space-y-1">
                        {m.attachments.map((file) => (
                          <a
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs underline opacity-90"
                          >
                            {file.original_name}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-1 text-[10px] opacity-70">
                      {isNote ? "Note" : mine ? "Staff" : "Customer"} ·{" "}
                      {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-border bg-surface shrink-0 border-t p-3">
              {canned.length ? (
                <div className="mb-2 flex flex-wrap gap-1">
                  {canned.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => insertCanned(item)}
                    >
                      /{item.short_code}
                    </Button>
                  ))}
                </div>
              ) : null}
              <form onSubmit={onReply} className="flex gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder={
                      privateNote
                        ? "Private note… @name to mention · /canned"
                        : "Reply… type /shortcode for canned"
                    }
                    className="ui-input resize-none"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={privateNote}
                        onChange={(e) => setPrivateNote(e.target.checked)}
                      />
                      Private note
                    </label>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                    >
                      Attach
                    </Button>
                    {!privateNote ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={suggesting}
                        onClick={() => void onSuggestReply()}
                      >
                        {suggesting ? "Suggesting…" : "Suggest reply"}
                      </Button>
                    ) : null}
                    {files.length ? (
                      <span className="text-muted-foreground text-xs">{files.length} file(s)</span>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={sending || (!reply.trim() && files.length === 0)}
                  className="self-start"
                  size="sm"
                  variant={privateNote ? "secondary" : "default"}
                >
                  {sending ? "…" : privateNote ? "Note" : "Send"}
                </Button>
              </form>
              {error ? <p className="text-danger mt-2 text-xs">{error}</p> : null}
            </div>
          </>
        )}
      </section>

      {/* Contact context panel */}
      {selectedId && showContact ? (
        <aside className="border-border bg-[var(--surface-2)] hidden w-[320px] shrink-0 flex-col border-l 2xl:w-[360px] md:flex">
          <div className="border-border flex h-12 shrink-0 items-center border-b px-4 text-sm font-medium">
            Contact
          </div>
          <div className="space-y-4 overflow-y-auto p-4 text-sm">
            <div>
              <p className="text-base font-medium">{active?.contact?.name ?? "Visitor"}</p>
              <p className="text-muted-foreground text-xs">{active?.contact?.email ?? "—"}</p>
              <p className="text-muted-foreground text-xs">{active?.contact?.phone ?? "—"}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Labels
              </p>
              {labels.length === 0 ? (
                <p className="text-muted-foreground text-xs">No labels yet. Create them in admin.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => {
                    const on = activeLabelIds.has(label.id);
                    const color = label.color || "#0f6e56";
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => toggleLabel(label.id)}
                        title={on ? `Remove ${label.title}` : `Add ${label.title}`}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          on ? "text-white shadow-sm" : "bg-surface text-foreground hover:bg-white"
                        }`}
                        style={
                          on
                            ? { backgroundColor: color, borderColor: color }
                            : { borderColor: color, color }
                        }
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: on ? "#fff" : color }}
                        />
                        {label.title}
                      </button>
                    );
                  })}
                </div>
              )}
              {active?.labels?.length ? (
                <p className="text-muted-foreground mt-2 text-[11px]">
                  Applied: {active.labels.map((l) => l.title).join(", ")}
                </p>
              ) : (
                <p className="text-muted-foreground mt-2 text-[11px]">
                  Click a label to apply it to this conversation.
                </p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Attributes
              </p>
              <ul className="space-y-1 text-xs">
                {Object.entries(active?.contact?.custom_attributes ?? {}).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-medium">{k}</span>: {String(v)}
                  </li>
                ))}
                {!Object.keys(active?.contact?.custom_attributes ?? {}).length ? (
                  <li className="text-muted-foreground">No custom attributes</li>
                ) : null}
              </ul>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">
                Conversation #{active?.id} · {active?.status}
                {active?.muted ? " · muted" : ""}
              </p>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
