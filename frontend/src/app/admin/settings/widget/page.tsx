"use client";

import { TablePageSkeleton } from "@/components/loading-skeletons";

import { useEffect, useState } from "react";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api, Inbox } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function WidgetEmbedPage() {
  const { token } = useAdminToken();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<{ data: Inbox[] }>("/inboxes", { token }).then((res) => {
      setInbox(res.data.find((i) => i.channel === "website") ?? res.data[0] ?? null);
    });
  }, [token]);

  if (!token) return <TablePageSkeleton rows={4} />;

  const snippet = inbox
    ? `<script\n  src="http://127.0.0.1:8000/widget.js"\n  data-token="${inbox.widget_token}"\n  data-app="http://localhost:3000"\n  async\n></script>`
    : "Create a website inbox first.";

  return (
    <AdminCrudPage
      title="Widget embed"
      description="Production-style snippet — drop this on any website (beyond the /user demo page)."
    >
      <div className="ui-panel space-y-4 p-5 shadow-[var(--shadow)]">
        <p className="text-sm text-muted-foreground">
          Inbox: {inbox?.name ?? "—"} · token ready for embed
        </p>
        <pre className="bg-surface-2 overflow-x-auto rounded border border-border p-4 text-xs">
          {snippet}
        </pre>
        <Button
          type="button"
          disabled={!inbox}
          onClick={() => {
            navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy snippet"}
        </Button>
      </div>
    </AdminCrudPage>
  );
}
