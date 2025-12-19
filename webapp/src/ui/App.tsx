import React, { useMemo, useState } from "react";

import { useTheme } from "../contexts/ThemeProvider";
import { qsearchSearch } from "../utils/api";

type SearchHit = {
  doc_id: string;
  url: string;
  title: string;
  snippet: string;
  distance: number;
};

export function App() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState<boolean | null>(null);
  const [results, setResults] = useState<SearchHit[]>([]);

  const titleGlow = useMemo(() => {
    return resolvedTheme === "dark" ? "neon-text-cyan" : "";
  }, [resolvedTheme]);

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    setResults([]);
    setCacheHit(null);
    try {
      const res = await qsearchSearch(query, limit);
      setResults(res.results || []);
      setCacheHit(Boolean(res.cache_hit));
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-void">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className={`text-3xl font-extrabold tracking-tight ${titleGlow}`}>qsearch</div>
            <div className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
              Geometric ranking over basin coordinates (local-first; no external search APIs)
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="rounded-xl border border-light-border bg-light-bg-secondary px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg-secondary"
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              aria-label="Theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </header>

        <main className="mt-8">
          <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
            <input
              className="w-full flex-1 rounded-2xl border border-light-border bg-light-bg-secondary px-4 py-3 text-base outline-none transition focus:shadow-glow-electric-cyan dark:border-dark-border dark:bg-dark-bg-secondary"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              required
            />
            <input
              className="w-full rounded-2xl border border-light-border bg-light-bg-secondary px-4 py-3 text-base outline-none transition focus:shadow-glow-electric-blue dark:border-dark-border dark:bg-dark-bg-secondary sm:w-28"
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
            <button
              className="rounded-2xl bg-gradient-brand px-5 py-3 font-semibold text-white shadow-glow-electric-purple transition hover:opacity-95 disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </form>

          <div className="mt-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            {error ? (
              <span className="text-neon-electric-coral">{error}</span>
            ) : cacheHit === null ? (
              <span>&nbsp;</span>
            ) : (
              <span>
                Cache: <span className="font-semibold">{cacheHit ? "hit" : "miss"}</span>
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-3">
            {loading ? (
              <div className="rounded-2xl border border-light-border bg-light-bg-secondary p-6 shadow-glow-electric-cyan dark:border-dark-border dark:bg-dark-bg-secondary">
                <div className="h-4 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />
                <div className="mt-4 h-3 w-full animate-pulse rounded bg-black/10 dark:bg-white/10" />
                <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-black/10 dark:bg-white/10" />
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-2xl border border-light-border bg-light-bg-secondary p-8 text-light-text-secondary dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text-secondary">
                <div className="text-base font-semibold">No results yet</div>
                <div className="mt-1 text-sm">Crawl some pages, then search by basin distance.</div>
              </div>
            ) : (
              results.map((r) => (
                <a
                  key={r.doc_id}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-2xl border border-light-border bg-light-bg-secondary p-5 transition hover:bg-light-hover dark:border-dark-border dark:bg-dark-bg-secondary dark:hover:bg-dark-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-bold group-hover:underline">
                        {r.title || "(untitled)"}
                      </div>
                      <div className="mt-1 truncate text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {r.url}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full border border-light-border px-3 py-1 text-xs text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">
                      d={Number(r.distance).toFixed(4)}
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-light-text-primary/90 dark:text-dark-text-primary/90">
                    {r.snippet}
                  </div>
                </a>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
