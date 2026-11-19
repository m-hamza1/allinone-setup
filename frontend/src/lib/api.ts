const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type User = {
  id: number;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "staff";
  custom_role_id?: number | null;
  custom_role?: { id: number; name: string; permissions?: string[] } | null;
  permissions?: string[];
  account: { id: number; name: string; slug: string } | null;
};

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  role: User["role"];
  account_id: number | null;
  custom_role_id?: number | null;
  custom_role?: { id: number; name: string } | null;
};

export type ContactNote = {
  id: number;
  body: string;
  created_at: string;
  user?: { id: number; name: string } | null;
};

export type Contact = {
  id: number;
  name: string;
  email: string | null;
  phone?: string | null;
  custom_attributes?: Record<string, string | number | null>;
  notes?: ContactNote[];
  conversations_count?: number;
  conversations?: Conversation[];
  updated_at?: string;
};

export type Inbox = {
  id: number;
  name: string;
  channel: string;
  widget_token: string;
  conversations_count?: number;
};

export type Label = {
  id: number;
  title: string;
  color: string;
  description?: string | null;
};

export type CannedResponse = {
  id: number;
  short_code: string;
  content: string;
};

export type MessageAttachment = {
  id: number;
  original_name: string;
  mime_type?: string | null;
  url: string;
  size: number;
};

export type Message = {
  id: number;
  conversation_id: number;
  user_id: number | null;
  sender_type: "customer" | "staff" | "note";
  private?: boolean;
  body: string;
  created_at: string;
  user?: { id: number; name: string } | null;
  attachments?: MessageAttachment[];
  mentioned_users?: Array<{ id: number; name: string }>;
};

export type CustomView = {
  id: number;
  name: string;
  filters: {
    status?: "open" | "resolved" | "all";
    assignee?: "all" | "me" | "unassigned";
    label_id?: number | string;
  };
  is_shared?: boolean;
};

export type Macro = {
  id: number;
  name: string;
  actions: Array<Record<string, unknown>>;
};

export type AgentTeam = {
  id: number;
  name: string;
  description?: string | null;
};

export type Conversation = {
  id: number;
  status: "open" | "resolved";
  last_activity_at: string | null;
  assignee_id?: number | null;
  team_id?: number | null;
  locked_by?: number | null;
  priority?: "none" | "low" | "medium" | "high" | "urgent" | null;
  snoozed_until?: string | null;
  muted?: boolean;
  sla_due_at?: string | null;
  contact?: Contact;
  assignee?: { id: number; name: string } | null;
  locker?: { id: number; name: string } | null;
  team?: { id: number; name: string } | null;
  inbox?: { id: number; name: string; channel?: string };
  labels?: Label[];
  messages?: Message[];
  active_viewers?: Array<{ id: number; name?: string | null }>;
  latest_message?: Pick<Message, "id" | "body" | "sender_type" | "created_at"> | null;
};

function authHeaders(token?: string | null, json = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const inflightGets = new Map<string, Promise<unknown>>();

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null; timeoutMs?: number } = {},
): Promise<T> {
  const { token, timeoutMs = 12000, ...init } = options;
  const method = (init.method ?? "GET").toUpperCase();
  const coalesceKey =
    method === "GET" ? `${token ?? ""}:${path}` : null;

  if (coalesceKey && inflightGets.has(coalesceKey)) {
    return inflightGets.get(coalesceKey) as Promise<T>;
  }

  const run = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (init.signal) {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
      const res = await fetch(`${API_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          ...authHeaders(token, !isForm),
          ...(init.headers ?? {}),
        },
      });

      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          if (typeof body.message === "string") message = body.message;
          else if (body.errors) {
            const first = Object.values(body.errors).flat()[0];
            if (typeof first === "string") message = first;
          }
        } catch {
          /* ignore */
        }
        throw new ApiError(message, res.status);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError("Request timed out — is the API running on :8000?", 0);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  })();

  if (coalesceKey) {
    inflightGets.set(coalesceKey, run);
    run.finally(() => {
      if (inflightGets.get(coalesceKey) === run) inflightGets.delete(coalesceKey);
    });
  }

  return run;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("allin_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("allin_token", token);
  else localStorage.removeItem("allin_token");
}
