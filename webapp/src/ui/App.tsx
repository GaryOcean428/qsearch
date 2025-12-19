import React, { useMemo, useState } from "react";

import { useTheme } from "../contexts/ThemeProvider";
import { useAuth } from "../contexts/AuthContext";
import { qsearchSearch } from "../utils/api";
import { LoginModal } from "./LoginModal";
import { UserMenu } from "./UserMenu";

import logoDark from "../assets/qsearch_logo_with_text_dark.png";
import logoLight from "../assets/qsearch_logo_with_text_light.png";

type SearchHit = {
  doc_id: string;
  url: string;
  title: string;
  snippet: string;
  distance: number;
};

export function App() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { authenticated, authEnabled, loading: authLoading } = useAuth();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState<boolean | null>(null);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const isDark = resolvedTheme === "dark";
  const currentLogo = isDark ? logoDark : logoLight;

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
    <div className="min-h-screen" style={{ background: 'var(--bg-body)' }}>
      <div className="mx-auto max-w-6xl px-5 py-8">
        {/* Header with Logo and Auth */}
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between mb-10">
          <div className="flex items-center gap-4">
            <img
              src={currentLogo}
              alt="qsearch"
              className="h-12 logo-glow"
              style={{ filter: isDark ? 'drop-shadow(0 0 8px rgba(0, 191, 255, 0.5))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))' }}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Selector */}
            <select
              className="glass-panel px-3 py-2 text-sm rounded-lg outline-none transition"
              style={{
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              aria-label="Theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>

            {/* Auth Button/Menu */}
            {authEnabled && !authLoading && (
              authenticated ? (
                <UserMenu />
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-4 py-2 rounded-lg font-semibold transition"
                  style={{
                    background: 'var(--accent-secondary)',
                    color: 'var(--color-dark)',
                    boxShadow: 'var(--button-shadow)',
                  }}
                >
                  Sign In
                </button>
              )
            )}
          </div>
        </header>

        {/* Subtitle */}
        <div className="mb-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Geometric ranking over basin coordinates • Local-first search with no external APIs
          </p>
        </div>

        {/* Search Form */}
        <main className="mt-8">
          <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
            <input
              className="glass-panel w-full flex-1 px-5 py-4 text-base rounded-xl outline-none transition"
              style={{
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the knowledge graph…"
              required
            />
            <input
              className="glass-panel w-full px-4 py-4 text-base rounded-xl outline-none transition sm:w-28"
              style={{
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label="Result limit"
            />
            <button
              className="px-6 py-4 rounded-xl font-semibold transition disabled:opacity-60"
              style={{
                background: 'var(--accent-secondary)',
                color: 'var(--color-dark)',
                boxShadow: 'var(--button-shadow)',
              }}
              disabled={loading}
              type="submit"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </form>

          {/* Status Message */}
          <div className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {error ? (
              <span style={{ color: 'var(--accent-secondary)' }}>⚠ {error}</span>
            ) : cacheHit === null ? (
              <span>&nbsp;</span>
            ) : (
              <span>
                Cache: <span className="font-semibold">{cacheHit ? "✓ hit" : "✗ miss"}</span>
              </span>
            )}
          </div>

          {/* Results */}
          <div className="mt-8 grid gap-4">
            {loading ? (
              <div className="glass-panel p-8 rounded-xl">
                <div className="h-4 w-32 animate-pulse rounded" style={{ background: 'var(--bg-input)' }} />
                <div className="mt-4 h-3 w-full animate-pulse rounded" style={{ background: 'var(--bg-input)' }} />
                <div className="mt-2 h-3 w-5/6 animate-pulse rounded" style={{ background: 'var(--bg-input)' }} />
              </div>
            ) : results.length === 0 ? (
              <div className="glass-panel p-10 rounded-xl text-center">
                <div className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  No results yet
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Crawl some pages, then search by basin distance
                </div>
              </div>
            ) : (
              results.map((r) => (
                <a
                  key={r.doc_id}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="glass-panel group block p-6 rounded-xl transition"
                  style={{
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-bold group-hover:underline" style={{ color: 'var(--text-heading)' }}>
                        {r.title || "(untitled)"}
                      </div>
                      <div className="mt-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {r.url}
                      </div>
                    </div>
                    <div
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-mono"
                      style={{
                        background: 'var(--bg-input)',
                        color: 'var(--accent-primary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      d={Number(r.distance).toFixed(4)}
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {r.snippet}
                  </div>
                </a>
              ))
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t text-center text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
          <p>
            Powered by basin coordinate geometry • Built with{" "}
            <span style={{ color: 'var(--accent-secondary)' }}>♥</span> for local-first search
          </p>
        </footer>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      )}
    </div>
  );
}
