"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { api, TeamMember } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TablePageSkeleton } from "@/components/loading-skeletons";
import { cacheGet, cacheKey, cacheSet } from "@/lib/page-cache";

type CustomRole = { id: number; name: string };

export default function AdminTeamPage() {
  const { token } = useAuth({
    roles: ["admin", "super_admin"],
  });
  const cached = token ? cacheGet<TeamMember[]>(cacheKey(token, "team")) : null;
  const [team, setTeam] = useState<TeamMember[]>(() => cached ?? []);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "password",
    role: "staff" as "staff" | "admin",
    custom_role_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(cached));

  async function load(auth: string) {
    const [teamRes, rolesRes] = await Promise.all([
      api<{ data: TeamMember[] }>("/team", { token: auth, timeoutMs: 8000 }),
      api<{ data: CustomRole[] }>("/custom-roles", { token: auth, timeoutMs: 8000 }).catch(
        () => ({ data: [] as CustomRole[] }),
      ),
    ]);
    setTeam(teamRes.data);
    setRoles(rolesRes.data ?? []);
    cacheSet(cacheKey(auth, "team"), teamRes.data);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    load(token)
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load team");
        }
      })
      .finally(() => {
        if (!cancelled) setHasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await api("/team", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          custom_role_id:
            form.role === "staff" && form.custom_role_id
              ? Number(form.custom_role_id)
              : null,
        }),
      });
      setForm({
        name: "",
        email: "",
        password: "password",
        role: "staff",
        custom_role_id: "",
      });
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function assignRole(member: TeamMember, customRoleId: string) {
    if (!token) return;
    setError(null);
    try {
      await api(`/team/${member.id}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          custom_role_id: customRoleId ? Number(customRoleId) : null,
        }),
      });
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  if (!token) return null;

  const waitingForData = !hasLoaded && team.length === 0;

  return waitingForData ? (
    <TablePageSkeleton />
  ) : (
    <div className="h-full overflow-y-auto p-6">
      <div className="w-full space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] mb-1 text-3xl">Team</h1>
          <p className="text-muted-foreground text-sm">
            Create staff and admins who can operate this account. Assign a custom role pack to
            staff.
          </p>
        </div>

        <form
          onSubmit={onCreate}
          className="ui-panel grid gap-3 p-5 shadow-[var(--shadow)] sm:grid-cols-2"
        >
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Full name"
            className="ui-input"
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Email"
            className="ui-input"
            required
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Password"
            className="ui-input"
            required
          />
          <select
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({ ...f, role: e.target.value as "staff" | "admin" }))
            }
            className="ui-input"
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          {form.role === "staff" ? (
            <select
              value={form.custom_role_id}
              onChange={(e) => setForm((f) => ({ ...f, custom_role_id: e.target.value }))}
              className="ui-input sm:col-span-2"
            >
              <option value="">Default staff permissions</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button type="submit" disabled={saving} className="sm:col-span-2">
            {saving ? "Creating…" : "Add team member"}
          </Button>
        </form>

        {error ? <p className="text-danger text-sm">{error}</p> : null}

        <div className="ui-panel overflow-hidden shadow-[var(--shadow)]">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Permission pack</th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{member.name}</td>
                  <td className="text-muted-foreground px-4 py-3">{member.email}</td>
                  <td className="px-4 py-3 capitalize">
                    <span className="ui-chip ui-chip-open">
                      {member.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {member.role === "staff" ? (
                      <select
                        className="ui-input max-w-[220px]"
                        value={member.custom_role_id ?? ""}
                        onChange={(e) => assignRole(member, e.target.value)}
                      >
                        <option value="">Default staff</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted-foreground text-xs">Full access</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
