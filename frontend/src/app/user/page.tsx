"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, Message } from "@/lib/api";
import { Button } from "@/components/ui/button";

const WIDGET_TOKEN =
  process.env.NEXT_PUBLIC_WIDGET_TOKEN ?? "demo-widget-token-change-me";

const STORAGE_KEY = "allin_user_conversation_id";

type WidgetBootstrap = {
  inbox_name: string;
  widget_title?: string;
  widget_tagline?: string;
  enable_csat?: boolean;
  pre_chat?: {
    collect_name?: boolean;
    collect_email?: boolean;
    require_email?: boolean;
  };
  theme?: { primary?: string; bubble_position?: string };
};

export default function UserPortalPage() {
  const [name, setName] = useState("Website visitor");
  const [email, setEmail] = useState("visitor@example.com");
  const [draft, setDraft] = useState("Hi, I need help with my order.");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inboxName, setInboxName] = useState("Support");
  const [tagline, setTagline] = useState("We typically reply in a few minutes");
  const [primary, setPrimary] = useState("#0f6e56");
  const [preChat, setPreChat] = useState({ collect_name: true, collect_email: true, require_email: false });
  const [csatEnabled, setCsatEnabled] = useState(true);
  const [showCsat, setShowCsat] = useState(false);
  const [csatScore, setCsatScore] = useState<number | null>(null);
  const [csatFeedback, setCsatFeedback] = useState("");
  const [csatDone, setCsatDone] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const pollInFlight = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setConversationId(Number(saved));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ data: WidgetBootstrap }>(
      `/widget/bootstrap?widget_token=${encodeURIComponent(WIDGET_TOKEN)}`,
      { timeoutMs: 6000 },
    )
      .then((res) => {
        if (cancelled) return;
        setInboxName(res.data.widget_title || res.data.inbox_name);
        if (res.data.widget_tagline) setTagline(res.data.widget_tagline);
        if (res.data.theme?.primary) setPrimary(res.data.theme.primary);
        if (res.data.pre_chat) {
          setPreChat({
            collect_name: res.data.pre_chat.collect_name ?? true,
            collect_email: res.data.pre_chat.collect_email ?? true,
            require_email: res.data.pre_chat.require_email ?? false,
          });
        }
        setCsatEnabled(res.data.enable_csat ?? true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    localStorage.setItem(STORAGE_KEY, String(conversationId));
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || pollInFlight.current || document.hidden) return;
      pollInFlight.current = true;
      try {
        const lastId = messages[messages.length - 1]?.id;
        const qs = new URLSearchParams({
          widget_token: WIDGET_TOKEN,
          ...(lastId ? { after_id: String(lastId) } : {}),
        });
        const data = await api<{
          data: Message[];
          conversation?: { status?: string };
        }>(`/widget/conversations/${conversationId}/messages?${qs.toString()}`, {
          timeoutMs: 8000,
        });
        if (cancelled) return;
        if (data.data.length) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            return [...prev, ...data.data.filter((m) => !ids.has(m.id))];
          });
        }
        if (data.conversation?.status === "resolved" && csatEnabled && !csatDone) {
          setResolved(true);
          setShowCsat(true);
        }
      } catch {
        /* ignore */
      } finally {
        pollInFlight.current = false;
      }
    };

    const timer = setInterval(tick, 20000);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [conversationId, messages, csatEnabled, csatDone]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function startChat(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{
        data: {
          conversation_id: number;
          message: Message;
          messages?: Message[];
        };
      }>("/widget/start", {
        method: "POST",
        body: JSON.stringify({
          widget_token: WIDGET_TOKEN,
          name: preChat.collect_name ? name : undefined,
          email: preChat.collect_email ? email : undefined,
          message: draft,
        }),
      });
      setConversationId(data.data.conversation_id);
      setMessages(data.data.messages ?? [data.data.message]);
      setDraft("");
      setResolved(false);
      setShowCsat(false);
      setCsatDone(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start chat");
    } finally {
      setBusy(false);
    }
  }

  async function sendFollowUp(e: FormEvent) {
    e.preventDefault();
    if (!conversationId || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ data: Message }>(
        `/widget/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            widget_token: WIDGET_TOKEN,
            body: draft.trim(),
          }),
        },
      );
      setMessages((prev) => [...prev, data.data]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitCsat(e: FormEvent) {
    e.preventDefault();
    if (!conversationId || !csatScore) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/widget/conversations/${conversationId}/csat`, {
        method: "POST",
        body: JSON.stringify({
          widget_token: WIDGET_TOKEN,
          score: csatScore,
          feedback: csatFeedback || null,
        }),
      });
      setCsatDone(true);
      setShowCsat(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit rating");
    } finally {
      setBusy(false);
    }
  }

  function resetChat() {
    localStorage.removeItem(STORAGE_KEY);
    setConversationId(null);
    setMessages([]);
    setDraft("Hi, I need help with my order.");
    setShowCsat(false);
    setCsatDone(false);
    setResolved(false);
    setCsatScore(null);
    setCsatFeedback("");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_bottom_right,#d9e8ff,transparent_45%),#f4f6f8] px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            ← All portals
          </Link>
          <span className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
            User side
          </span>
        </div>

        <div className="bg-surface border-border shadow-[0_16px_48px_rgba(28,36,48,0.1)] overflow-hidden rounded-[3px] border">
          <div
            className="flex items-center justify-between gap-3 border-b px-5 py-4 text-white"
            style={{ backgroundColor: primary }}
          >
            <div>
              <p className="text-xs tracking-[0.16em] uppercase opacity-80">Chat with us</p>
              <h1 className="font-[family-name:var(--font-display)] text-2xl">{inboxName}</h1>
              <p className="mt-0.5 text-xs opacity-90">{tagline}</p>
            </div>
            {conversationId ? (
              <Button type="button" variant="secondary" size="sm" onClick={resetChat}>
                New chat
              </Button>
            ) : null}
          </div>

          {!conversationId ? (
            <form onSubmit={startChat} className="space-y-3 p-5">
              {preChat.collect_name ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="border-border focus:border-accent w-full rounded-[3px] border px-3 py-2 outline-none"
                />
              ) : null}
              {preChat.collect_email ? (
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required={preChat.require_email}
                  placeholder="Email"
                  className="border-border focus:border-accent w-full rounded-[3px] border px-3 py-2 outline-none"
                />
              ) : null}
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="border-border focus:border-accent w-full resize-none rounded-[3px] border px-3 py-2 outline-none"
                required
              />
              {error ? <p className="text-danger text-sm">{error}</p> : null}
              <Button type="submit" disabled={busy} className="w-full" size="lg" style={{ backgroundColor: primary }}>
                {busy ? "Starting…" : "Start conversation"}
              </Button>
            </form>
          ) : (
            <>
              <div className="bg-background h-80 space-y-2 overflow-y-auto p-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-[3px] px-3 py-2 text-sm ${
                      m.sender_type === "customer"
                        ? "ml-auto text-white"
                        : "bg-surface border-border border"
                    }`}
                    style={
                      m.sender_type === "customer" ? { backgroundColor: primary } : undefined
                    }
                  >
                    {m.body}
                  </div>
                ))}
                {resolved ? (
                  <p className="text-muted-foreground text-center text-xs">
                    Conversation resolved{csatDone ? " · thanks for your feedback" : ""}.
                  </p>
                ) : null}
                <div ref={endRef} />
              </div>

              {showCsat && !csatDone ? (
                <form onSubmit={submitCsat} className="border-border space-y-3 border-t p-4">
                  <p className="text-sm font-medium">How was your support experience?</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setCsatScore(score)}
                        className={`size-9 rounded-[3px] border text-sm ${
                          csatScore === score
                            ? "border-transparent text-white"
                            : "border-border bg-white"
                        }`}
                        style={csatScore === score ? { backgroundColor: primary } : undefined}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={csatFeedback}
                    onChange={(e) => setCsatFeedback(e.target.value)}
                    rows={2}
                    placeholder="Optional feedback"
                    className="border-border w-full resize-none rounded-[3px] border px-3 py-2 text-sm outline-none"
                  />
                  <Button type="submit" disabled={busy || !csatScore} style={{ backgroundColor: primary }}>
                    {busy ? "Sending…" : "Submit rating"}
                  </Button>
                </form>
              ) : (
                <form
                  onSubmit={sendFollowUp}
                  className="border-border flex gap-2 border-t p-4"
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message…"
                    className="border-border focus:border-accent flex-1 rounded-[3px] border px-3 py-2 outline-none"
                  />
                  <Button type="submit" disabled={busy || !draft.trim()} style={{ backgroundColor: primary }}>
                    Send
                  </Button>
                </form>
              )}
              {error ? <p className="text-danger px-4 pb-3 text-sm">{error}</p> : null}
              {csatEnabled && conversationId && !showCsat && !csatDone ? (
                <div className="px-4 pb-3">
                  <button
                    type="button"
                    className="text-muted-foreground text-xs underline"
                    onClick={() => setShowCsat(true)}
                  >
                    Rate this conversation
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
