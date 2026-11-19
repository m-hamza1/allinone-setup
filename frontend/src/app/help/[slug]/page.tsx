"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type Portal = {
  name: string;
  headline?: string | null;
  default_locale?: string;
  locales?: string[];
  articles: Array<{ id: number; title: string; body?: string | null; locale?: string }>;
  categories: Array<{ id: number; name: string }>;
};

export default function PublicHelpPage() {
  const params = useParams<{ slug: string }>();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [locale, setLocale] = useState("");

  async function load(nextQ = q, nextLocale = locale) {
    if (!params.slug) return;
    const qs = new URLSearchParams();
    if (nextQ.trim()) qs.set("q", nextQ.trim());
    if (nextLocale) qs.set("locale", nextLocale);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await api<{ data: Portal }>(`/help/${params.slug}${suffix}`);
    setPortal(res.data);
    if (!nextLocale && res.data.default_locale) {
      setLocale(res.data.default_locale);
    }
  }

  useEffect(() => {
    if (!params.slug) return;
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Not found"));
  }, [params.slug]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await load(q, locale);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }

  if (error && !portal) {
    return <main className="grid min-h-screen place-items-center p-6">{error}</main>;
  }

  if (!portal) {
    return <main className="grid min-h-screen place-items-center p-6 text-muted-foreground">Loading…</main>;
  }

  const locales = portal.locales?.length ? portal.locales : [portal.default_locale || "en"];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12">
      <p className="text-muted-foreground mb-2 text-xs tracking-[0.18em] uppercase">Help Center</p>
      <h1 className="font-[family-name:var(--font-display)] mb-2 text-4xl">{portal.name}</h1>
      <p className="text-muted-foreground mb-8 text-lg">{portal.headline}</p>

      <form onSubmit={onSearch} className="mb-10 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search articles…"
          className="border-border h-10 min-w-[220px] flex-1 rounded-[3px] border bg-white px-3 text-sm outline-none"
        />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className="border-border h-10 rounded-[3px] border bg-white px-3 text-sm"
        >
          {locales.map((code) => (
            <option key={code} value={code}>
              {code.toUpperCase()}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-foreground h-10 rounded-[3px] px-4 text-sm font-medium text-white"
        >
          Search
        </button>
      </form>

      {error ? <p className="text-danger mb-4 text-sm">{error}</p> : null}

      <div className="space-y-8">
        {portal.articles.map((article) => (
          <article key={article.id} className="border-b border-border pb-8">
            <h2 className="mb-2 text-2xl font-medium">{article.title}</h2>
            {article.locale ? (
              <p className="text-muted-foreground mb-2 text-xs uppercase">{article.locale}</p>
            ) : null}
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{article.body}</p>
          </article>
        ))}
        {!portal.articles.length ? (
          <p className="text-muted-foreground text-sm">No articles match this search.</p>
        ) : null}
      </div>
    </main>
  );
}
