"use client";

import { useEffect, useState } from "react";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api } from "@/lib/api";
import { TablePageSkeleton } from "@/components/loading-skeletons";

type Log = {
  id: number;
  action: string;
  auditable_type?: string | null;
  auditable_id?: number | null;
  created_at: string;
  user?: { id: number; name: string } | null;
  meta?: Record<string, unknown> | null;
};

export default function AuditLogsPage() {
  const { token } = useAdminToken();
  const [items, setItems] = useState<Log[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ data: Log[] }>("/audit-logs", { token, timeoutMs: 10000 })
      .then((res) => setItems(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setHasLoaded(true));
  }, [token]);

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage title="Audit logs" description="Who changed staff, channels, and automations.">
      {!hasLoaded ? (
        <TablePageSkeleton rows={6} />
      ) : (
        <div className="space-y-3">
          {error ? <p className="text-danger text-sm">{error}</p> : null}
          <ul className="border-border bg-surface divide-y overflow-hidden rounded-xl border">
            {items.map((log) => (
              <li key={log.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{log.action}</p>
                <p className="text-muted-foreground text-xs">
                  {log.user?.name ?? "System"} · {new Date(log.created_at).toLocaleString()}
                  {log.auditable_type ? ` · ${log.auditable_type}#${log.auditable_id}` : ""}
                </p>
              </li>
            ))}
            {!items.length ? (
              <li className="text-muted-foreground px-4 py-8 text-center text-sm">
                No audit events yet — create a staff member or channel to generate logs.
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </AdminCrudPage>
  );
}
