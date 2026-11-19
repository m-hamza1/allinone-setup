"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, Contact } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ContactsSkeleton } from "@/components/loading-skeletons";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cacheGet, cacheKey, cacheSet } from "@/lib/page-cache";

export function ContactsWorkspace({
  token,
  inboxHref = "/staff/inbox",
}: {
  token: string;
  inboxHref?: string;
}) {
  const key = cacheKey(token, "contacts");
  const cached = cacheGet<Contact[]>(key);

  const [contacts, setContacts] = useState<Contact[]>(() => cached ?? []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(cached));
  const [noteBody, setNoteBody] = useState("");
  const [attrKey, setAttrKey] = useState("company");
  const [attrValue, setAttrValue] = useState("");

  const loadContacts = useCallback(async () => {
    const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    const data = await api<{ data: Contact[] }>(`/contacts${qs}`, { token, timeoutMs: 8000 });
    const list = data.data ?? [];
    setContacts(list);
    if (!search.trim()) cacheSet(key, list);
  }, [token, search, key]);

  useEffect(() => {
    let cancelled = false;
    loadContacts()
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load contacts");
        }
      })
      .finally(() => {
        if (!cancelled) setHasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadContacts]);

  async function openContact(id: number) {
    const data = await api<{ data: Contact }>(`/contacts/${id}`, { token, timeoutMs: 8000 });
    setSelected(data.data);
    setForm({
      name: data.data.name,
      email: data.data.email ?? "",
      phone: data.data.phone ?? "",
    });
    setCreating(false);
  }

  async function saveContact(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (creating) {
        const created = await api<{ data: Contact }>("/contacts", {
          method: "POST",
          token,
          body: JSON.stringify(form),
        });
        setCreating(false);
        setSelected(created.data);
      } else if (selected) {
        const data = await api<{ data: Contact }>(`/contacts/${selected.id}`, {
          method: "PUT",
          token,
          body: JSON.stringify(form),
        });
        setSelected(data.data);
      }
      await loadContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function startCreate() {
    setCreating(true);
    setSelected(null);
    setForm({ name: "", email: "", phone: "" });
    setError(null);
  }

  if (!hasLoaded) {
    return <ContactsSkeleton />;
  }

  return (
    <div className="bg-surface flex h-full min-h-0 w-full overflow-hidden">
      {/* Contact list — same rail as Conversations */}
      <aside className="border-border flex w-full min-h-0 shrink-0 flex-col border-r md:w-[340px] 2xl:w-[412px]">
        <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger className="size-7 shrink-0" />
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium">Contacts</h1>
          <span className="bg-secondary text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] tabular-nums">
            {contacts.length}
          </span>
          <Button type="button" size="sm" className="h-8 shrink-0" onClick={startCreate}>
            New
          </Button>
        </div>

        <div className="border-border space-y-2 border-b px-3 py-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts"
            className="border-border h-8 w-full rounded-md border bg-white px-3 text-sm outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="text-muted-foreground p-4 text-sm">
              No contacts yet.{" "}
              <button type="button" className="text-primary underline" onClick={startCreate}>
                Create one
              </button>
              .
            </div>
          ) : (
            contacts.map((c) => {
              const active = selected?.id === c.id && !creating;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openContact(c.id)}
                  className={`border-border w-full border-b px-3 py-3 text-left ${
                    active ? "bg-accent-soft" : "hover:bg-surface-2"
                  }`}
                >
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="text-muted-foreground shrink-0 text-[10px] uppercase">
                      {c.conversations_count ?? 0} CHATS
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {c.email || c.phone || "No email"}
                  </p>
                  <p className="text-muted-foreground mt-1 truncate text-[10px]">
                    {c.phone && c.email ? c.phone : "Contact"}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Detail pane — same as conversation chat pane */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!creating && !selected ? (
          <div className="text-muted-foreground grid flex-1 place-items-center text-sm">
            Select a contact
          </div>
        ) : (
          <>
            <div className="border-border bg-surface flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b px-3">
              <div className="min-w-0 shrink truncate">
                <p className="truncate text-sm font-medium leading-tight">
                  {creating ? "New contact" : selected?.name}
                  {!creating && selected?.email ? (
                    <span className="text-muted-foreground font-normal"> · {selected.email}</span>
                  ) : null}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {!creating && selected ? (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href={inboxHref}>Inbox</Link>
                  </Button>
                ) : null}
                {creating ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-2)] p-4">
              <div className="w-full space-y-4">
                <form
                  onSubmit={saveContact}
                  className="border-border bg-surface rounded-lg border p-4"
                >
                  <p className="mb-3 text-sm font-medium">Contact details</p>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label htmlFor="contact-name" className="text-muted-foreground block text-xs">
                        Name
                      </label>
                      <input
                        id="contact-name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="border-border focus:border-primary h-9 w-full rounded-md border bg-white px-3 text-sm outline-none"
                        placeholder="Full name"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <label
                          htmlFor="contact-email"
                          className="text-muted-foreground block text-xs"
                        >
                          Email
                        </label>
                        <input
                          id="contact-email"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          className="border-border focus:border-primary h-9 w-full rounded-md border bg-white px-3 text-sm outline-none"
                          type="email"
                          placeholder="name@company.com"
                        />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <label
                          htmlFor="contact-phone"
                          className="text-muted-foreground block text-xs"
                        >
                          Phone
                        </label>
                        <input
                          id="contact-phone"
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          className="border-border focus:border-primary h-9 w-full rounded-md border bg-white px-3 text-sm outline-none"
                          placeholder="+1 555 000 0000"
                        />
                      </div>
                    </div>
                  </div>

                  {error ? <p className="text-danger mt-3 text-sm">{error}</p> : null}

                  <div className="mt-4 flex justify-end">
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? "Saving…" : creating ? "Create contact" : "Save changes"}
                    </Button>
                  </div>
                </form>

                {!creating && selected ? (
                  <>
                    <div className="border-border bg-surface rounded-lg border p-4">
                      <p className="mb-3 text-sm font-medium">Custom attributes</p>
                      <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <label
                            htmlFor="attr-key"
                            className="text-muted-foreground block text-xs"
                          >
                            Key
                          </label>
                          <input
                            id="attr-key"
                            className="border-border focus:border-primary h-9 w-full rounded-md border bg-white px-3 text-sm outline-none"
                            value={attrKey}
                            onChange={(e) => setAttrKey(e.target.value)}
                            placeholder="company"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <label
                            htmlFor="attr-value"
                            className="text-muted-foreground block text-xs"
                          >
                            Value
                          </label>
                          <input
                            id="attr-value"
                            className="border-border focus:border-primary h-9 w-full rounded-md border bg-white px-3 text-sm outline-none"
                            value={attrValue}
                            onChange={(e) => setAttrValue(e.target.value)}
                            placeholder="Acme Inc"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 shrink-0 px-4"
                          onClick={async () => {
                            if (!attrKey.trim()) return;
                            const next = {
                              ...(selected.custom_attributes ?? {}),
                              [attrKey.trim()]: attrValue,
                            };
                            const data = await api<{ data: Contact }>(
                              `/contacts/${selected.id}`,
                              {
                                method: "PUT",
                                token,
                                body: JSON.stringify({ custom_attributes: next }),
                              },
                            );
                            setSelected(data.data);
                            setAttrValue("");
                          }}
                        >
                          Add
                        </Button>
                      </div>

                      <ul className="mt-3 space-y-0">
                        {Object.keys(selected.custom_attributes ?? {}).length ? (
                          Object.entries(selected.custom_attributes ?? {}).map(([k, v]) => (
                            <li
                              key={k}
                              className="border-border flex items-start gap-3 border-t py-2 text-sm first:border-t-0"
                            >
                              <span className="text-muted-foreground w-28 shrink-0 truncate text-xs font-medium">
                                {k}
                              </span>
                              <span className="min-w-0 flex-1 break-all text-sm">{String(v)}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-muted-foreground text-xs">No custom attributes yet.</li>
                        )}
                      </ul>
                    </div>

                    <div className="border-border bg-surface rounded-lg border p-4">
                      <p className="mb-3 text-sm font-medium">Notes</p>
                      <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <label htmlFor="note-body" className="text-muted-foreground block text-xs">
                            Note
                          </label>
                          <input
                            id="note-body"
                            className="border-border focus:border-primary h-9 w-full rounded-md border bg-white px-3 text-sm outline-none"
                            value={noteBody}
                            onChange={(e) => setNoteBody(e.target.value)}
                            placeholder="Add an internal note"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 shrink-0 px-4"
                          onClick={async () => {
                            if (!noteBody.trim()) return;
                            await api(`/contacts/${selected.id}/notes`, {
                              method: "POST",
                              token,
                              body: JSON.stringify({ body: noteBody.trim() }),
                            });
                            setNoteBody("");
                            await openContact(selected.id);
                          }}
                        >
                          Add
                        </Button>
                      </div>

                      <ul className="mt-3 space-y-0">
                        {(selected.notes ?? []).length ? (
                          (selected.notes ?? []).map((note) => (
                            <li
                              key={note.id}
                              className="border-border border-t py-2 text-sm first:border-t-0"
                            >
                              <p>{note.body}</p>
                              <p className="text-muted-foreground mt-1 text-[11px]">
                                {note.user?.name ?? "Staff"} ·{" "}
                                {new Date(note.created_at).toLocaleString()}
                              </p>
                            </li>
                          ))
                        ) : (
                          <li className="text-muted-foreground text-xs">No notes yet.</li>
                        )}
                      </ul>
                    </div>

                    <div className="border-border bg-surface overflow-hidden rounded-lg border">
                      <div className="border-border border-b px-4 py-3 text-sm font-medium">
                        Conversations
                      </div>
                      {(selected.conversations ?? []).length ? (
                        <ul>
                          {selected.conversations!.map((conv) => (
                            <li
                              key={conv.id}
                              className="border-border flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm last:border-b-0"
                            >
                              <span className="min-w-0 truncate">
                                #{conv.id} · {conv.inbox?.name ?? "Inbox"}
                              </span>
                              <span className="text-muted-foreground shrink-0 text-[10px] uppercase">
                                {conv.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground px-4 py-3 text-xs">
                          No conversations linked.
                        </p>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
