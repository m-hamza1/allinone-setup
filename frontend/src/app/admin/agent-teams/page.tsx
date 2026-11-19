"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api, TeamMember } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AgentTeam = {
  id: number;
  name: string;
  description?: string | null;
  members?: TeamMember[];
  members_count?: number;
};

export default function AgentTeamsPage() {
  const { token } = useAdminToken();
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [agents, setAgents] = useState<TeamMember[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    const [t, a] = await Promise.all([
      api<{ data: AgentTeam[] }>("/agent-teams", { token }),
      api<{ data: TeamMember[] }>("/team", { token }),
    ]);
    setTeams(t.data);
    setAgents(a.data.filter((m) => m.role !== "super_admin"));
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await api("/agent-teams", {
        method: "POST",
        token,
        body: JSON.stringify({ name, description, member_ids: memberIds }),
      });
      setName("");
      setDescription("");
      setMemberIds([]);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <AdminCrudPage
      title="Teams"
      description="Staff groups for assignment and routing."
      actions={
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Create team
        </Button>
      }
    >
      <ul className="border-border bg-surface divide-y overflow-hidden rounded-[3px] border">
        {teams.map((team) => (
          <li key={team.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{team.name}</p>
              <p className="text-muted-foreground text-sm">{team.description || "No description"}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {(team.members ?? []).map((m) => m.name).join(", ") || "No members"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await api(`/agent-teams/${team.id}`, { method: "DELETE", token });
                await load();
              }}
            >
              Delete
            </Button>
          </li>
        ))}
        {!teams.length ? (
          <li className="text-muted-foreground px-4 py-8 text-center text-sm">No teams yet.</li>
        ) : null}
      </ul>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create team</SheetTitle>
            <SheetDescription>Name the group and pick members.</SheetDescription>
          </SheetHeader>
          <form onSubmit={onCreate} className="mt-6 space-y-4 px-4 pb-6">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Team name"
                required
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Description</span>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
              />
            </label>
            <div className="space-y-2">
              <p className="text-sm font-medium">Members</p>
              <div className="flex flex-wrap gap-2">
                {agents.map((agent) => {
                  const on = memberIds.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      className={`rounded-[3px] border px-2 py-1 text-xs ${
                        on ? "bg-accent text-white" : "border-border"
                      }`}
                      onClick={() =>
                        setMemberIds((ids) =>
                          on ? ids.filter((id) => id !== agent.id) : [...ids, agent.id],
                        )
                      }
                    >
                      {agent.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {error ? <p className="text-danger text-sm">{error}</p> : null}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving…" : "Create team"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
