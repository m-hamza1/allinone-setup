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

type TokenRow = {
  id: number;
  name: string;
  token_prefix: string;
  last_used_at?: string | null;
};

export default function PlatformApiPage() {
  const { token } = useAdminToken();
  const [items, setItems] = useState<TokenRow[]>([]);
  const [name, setName] = useState("CI bot");
  const [plain, setPlain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!token) return;
    const res = await api<{ data: TokenRow[] }>("/platform/tokens", { token });
    setItems(res.data ?? []);
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
    setError(null);
    try {
      const res = await api<{ data: TokenRow & { token: string } }>("/platform/tokens", {
        method: "POST",
        token,
        body: JSON.stringify({ name }),
      });
      setPlain(res.data.token);
      setName("CI bot");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage
      title="Platform API"
      description="Account-scoped API tokens for /api/platform/v1."
      actions={
        <Button type="button" size="sm" onClick={() => { setError(null); setOpen(true); }}>
          Create token
        </Button>
      }
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={3} />
      ) : (
        <div className="space-y-4">
          {plain ? (
            <div className="border-border bg-surface rounded-[3px] border p-4 text-sm">
              <p className="mb-2 font-medium">Copy this token now — it won’t be shown again.</p>
              <code className="block break-all rounded-[3px] bg-black/5 p-3 font-mono text-xs">
                {plain}
              </code>
            </div>
          ) : null}
          {error && !open ? <p className="text-danger text-sm">{error}</p> : null}
          <ul className="border-border bg-surface divide-y overflow-hidden rounded-[3px] border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {item.token_prefix}… · last used {item.last_used_at ?? "never"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await api(`/platform/tokens/${item.id}`, { method: "DELETE", token });
                    await load();
                  }}
                >
                  Revoke
                </Button>
              </li>
            ))}
            {!items.length ? (
              <li className="text-muted-foreground px-4 py-8 text-center text-sm">No tokens yet.</li>
            ) : null}
          </ul>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Create API token</SheetTitle>
            <SheetDescription>Use as Bearer token on platform/v1 routes.</SheetDescription>
          </SheetHeader>
          <form onSubmit={onCreate} className="mt-6 space-y-4 px-4 pb-6">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="submit" className="w-full">
              Create
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
