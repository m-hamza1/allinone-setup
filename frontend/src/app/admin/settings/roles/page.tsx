"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type PermissionDef = { key: string; label: string; group: string };
type CustomRole = {
  id: number;
  name: string;
  description?: string | null;
  permissions?: string[];
};

export default function CustomRolesPage() {
  const { token } = useAdminToken();
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const item of catalog) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [catalog]);

  async function load() {
    if (!token) return;
    const [rolesRes, catalogRes] = await Promise.all([
      api<{ data: CustomRole[] }>("/custom-roles", { token }),
      api<{ data: PermissionDef[] }>("/custom-roles/catalog", { token }),
    ]);
    setRoles(rolesRes.data ?? []);
    setCatalog(catalogRes.data ?? []);
  }

  useEffect(() => {
    if (!token) return;
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setHasLoaded(true));
  }, [token]);

  function togglePermission(key: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await api("/custom-roles", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          permissions: form.permissions,
        }),
      });
      setForm({ name: "", description: "", permissions: [] });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    if (!token) return;
    setError(null);
    try {
      await api(`/custom-roles/${id}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage
      title="Custom roles"
      description="Permission packs assigned to staff — enforced on API routes."
      actions={
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Add role
        </Button>
      }
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={4} />
      ) : (
        <div className="space-y-3">
          {error && !open ? <p className="text-danger text-sm">{error}</p> : null}
          {roles.map((role) => (
            <article
              key={role.id}
              className="border-border bg-surface flex flex-wrap items-start justify-between gap-3 rounded-[3px] border p-4"
            >
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-medium">{role.name}</h2>
                <p className="text-muted-foreground text-sm">{role.description || "—"}</p>
                <p className="text-muted-foreground text-xs">
                  {(role.permissions ?? []).join(", ") || "no permissions"}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => onDelete(role.id)}>
                Delete
              </Button>
            </article>
          ))}
          {!roles.length ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No custom roles yet.</p>
          ) : null}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add role</SheetTitle>
            <SheetDescription>Pick permissions for this pack.</SheetDescription>
          </SheetHeader>
          <form onSubmit={onCreate} className="mt-6 space-y-4 px-4 pb-6">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Name</span>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Support staff"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Description</span>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Can reply and manage contacts"
              />
            </label>
            <div className="space-y-3">
              <p className="text-sm font-medium">Permissions</p>
              {grouped.map(([group, items]) => (
                <div key={group} className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {group}
                  </p>
                  <div className="grid gap-2">
                    {items.map((item) => (
                      <label
                        key={item.key}
                        className="border-border hover:bg-surface-2 flex cursor-pointer items-start gap-2 rounded-[3px] border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={form.permissions.includes(item.key)}
                          onChange={() => togglePermission(item.key)}
                        />
                        <span>
                          <span className="font-medium">{item.label}</span>
                          <span className="text-muted-foreground block font-mono text-[11px]">
                            {item.key}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving…" : "Save role"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
