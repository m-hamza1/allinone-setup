"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePageSkeleton } from "@/components/loading-skeletons";

type Category = { id: number; name: string; slug: string; position: number };
type Article = {
  id: number;
  title: string;
  slug: string;
  body?: string | null;
  status: string;
  category_id?: number | null;
};
type Portal = {
  id: number;
  name: string;
  slug: string;
  headline?: string | null;
  is_published: boolean;
  categories_count?: number;
  articles_count?: number;
  categories?: Category[];
  articles?: Article[];
};

export default function HelpCenterAdminPage() {
  const { token } = useAdminToken();
  const [portals, setPortals] = useState<Portal[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [name, setName] = useState("Support docs");
  const [headline, setHeadline] = useState("How can we help?");
  const [locale, setLocale] = useState("en");
  const [categoryName, setCategoryName] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const [articleCategoryId, setArticleCategoryId] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const active = useMemo(
    () => portals.find((p) => p.id === activeId) ?? portals[0] ?? null,
    [portals, activeId],
  );

  async function load() {
    if (!token) return;
    const res = await api<{ data: Portal[] }>("/help-center/portals", { token });
    setPortals(res.data ?? []);
    if (!activeId && res.data?.[0]) setActiveId(res.data[0].id);
  }

  useEffect(() => {
    if (!token) return;
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setHasLoaded(true));
  }, [token]);

  async function onCreatePortal(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ data: Portal }>("/help-center/portals", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: `${name}${locale !== "en" ? ` (${locale})` : ""}`,
          headline,
          is_published: true,
        }),
      });
      await api(`/help-center/portals/${res.data.id}/categories`, {
        method: "POST",
        token,
        body: JSON.stringify({ name: "General" }),
      });
      await api(`/help-center/portals/${res.data.id}/articles`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: "Getting started",
          body: "Write your first help article here.",
          status: "published",
        }),
      });
      await load();
      setActiveId(res.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!token || !active || !categoryName.trim()) return;
    await api(`/help-center/portals/${active.id}/categories`, {
      method: "POST",
      token,
      body: JSON.stringify({ name: categoryName.trim() }),
    });
    setCategoryName("");
    await load();
  }

  async function saveArticle(e: FormEvent) {
    e.preventDefault();
    if (!token || !active || !articleTitle.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api(`/help-center/articles/${editingId}`, {
          method: "PUT",
          token,
          body: JSON.stringify({
            title: articleTitle,
            body: articleBody,
            category_id: articleCategoryId ? Number(articleCategoryId) : null,
            status: "published",
          }),
        });
      } else {
        await api(`/help-center/portals/${active.id}/articles`, {
          method: "POST",
          token,
          body: JSON.stringify({
            title: articleTitle,
            body: articleBody,
            category_id: articleCategoryId ? Number(articleCategoryId) : null,
            status: "published",
          }),
        });
      }
      setEditingId(null);
      setArticleTitle("");
      setArticleBody("");
      setArticleCategoryId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Article save failed");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(article: Article) {
    setEditingId(article.id);
    setArticleTitle(article.title);
    setArticleBody(article.body ?? "");
    setArticleCategoryId(article.category_id ? String(article.category_id) : "");
  }

  if (!token) return <TablePageSkeleton rows={6} />;

  return (
    <AdminCrudPage
      title="Help Center"
      description="Portals, categories, and article editor — publish to /help/{slug}."
    >
      {!hasLoaded ? (
        <TablePageSkeleton rows={6} />
      ) : (
        <div className="space-y-6">
          {error ? <p className="text-danger text-sm">{error}</p> : null}

          <form
            onSubmit={onCreatePortal}
            className="border-border bg-surface grid gap-3 rounded-xl border p-4 sm:grid-cols-4"
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Portal name" required />
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Headline"
            />
            <select
              className="border-border h-9 rounded-md border bg-white px-3 text-sm"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
            >
              <option value="en">English (en)</option>
              <option value="ur">Urdu (ur)</option>
              <option value="ar">Arabic (ar)</option>
              <option value="es">Spanish (es)</option>
            </select>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create portal"}
            </Button>
          </form>

          {portals.length ? (
            <div className="flex flex-wrap gap-2">
              {portals.map((portal) => (
                <button
                  key={portal.id}
                  type="button"
                  onClick={() => setActiveId(portal.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active?.id === portal.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border"
                  }`}
                >
                  {portal.name}
                </button>
              ))}
            </div>
          ) : null}

          {active ? (
            <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
              <aside className="border-border bg-surface space-y-4 rounded-xl border p-4">
                <div>
                  <p className="font-medium">{active.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {active.articles_count ?? active.articles?.length ?? 0} articles ·{" "}
                    {active.is_published ? "Published" : "Draft"}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href={`/help/${active.slug}`} target="_blank">
                      Open public
                    </Link>
                  </Button>
                </div>

                <form onSubmit={addCategory} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Categories
                  </p>
                  <ul className="space-y-1 text-sm">
                    {(active.categories ?? []).map((cat) => (
                      <li key={cat.id} className="truncate">
                        {cat.name}
                      </li>
                    ))}
                    {!active.categories?.length ? (
                      <li className="text-muted-foreground text-xs">None yet</li>
                    ) : null}
                  </ul>
                  <Input
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="New category"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="w-full">
                    Add category
                  </Button>
                </form>
              </aside>

              <div className="space-y-4">
                <form
                  onSubmit={saveArticle}
                  className="border-border bg-surface space-y-3 rounded-xl border p-4"
                >
                  <p className="text-sm font-medium">
                    {editingId ? "Edit article" : "New article"}
                  </p>
                  <Input
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder="Article title"
                    required
                  />
                  <select
                    className="border-border h-9 w-full rounded-md border bg-white px-3 text-sm"
                    value={articleCategoryId}
                    onChange={(e) => setArticleCategoryId(e.target.value)}
                  >
                    <option value="">No category</option>
                    {(active.categories ?? []).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    className="border-border min-h-40 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none"
                    value={articleBody}
                    onChange={(e) => setArticleBody(e.target.value)}
                    placeholder="Article body (markdown/plain)"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving…" : editingId ? "Update article" : "Publish article"}
                    </Button>
                    {editingId ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setArticleTitle("");
                          setArticleBody("");
                          setArticleCategoryId("");
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </form>

                <div className="border-border bg-surface overflow-hidden rounded-xl border">
                  <div className="border-border border-b px-4 py-3 text-sm font-medium">Articles</div>
                  <ul className="divide-border divide-y">
                    {(active.articles ?? []).map((article) => (
                      <li
                        key={article.id}
                        className="flex items-start justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{article.title}</p>
                          <p className="text-muted-foreground text-xs uppercase">
                            {article.status}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(article)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await api(`/help-center/articles/${article.id}`, {
                                method: "DELETE",
                                token,
                              });
                              await load();
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </li>
                    ))}
                    {!active.articles?.length ? (
                      <li className="text-muted-foreground px-4 py-6 text-center text-sm">
                        No articles yet.
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Create a portal to start writing articles.</p>
          )}
        </div>
      )}
    </AdminCrudPage>
  );
}
