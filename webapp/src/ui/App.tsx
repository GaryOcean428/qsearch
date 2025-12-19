import React, { useEffect, useState } from "react";

import { useTheme } from "../contexts/ThemeProvider";
import { useAuth } from "../contexts/AuthContext";
import { qsearchSearch, qsearchHybrid, getLearnerStats, type SearchResult, type LearnerStats } from "../utils/api";
import { LoginModal } from "./LoginModal";
import { UserMenu } from "./UserMenu";

import logoDark from "../assets/qsearch_logo_with_text_dark.png";
import logoLight from "../assets/qsearch_logo_with_text_light.png";

type SearchMode = "local" | "hybrid";

export function App() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { authenticated, authEnabled, loading: authLoading } = useAuth();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState<boolean | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Hybrid search state
  const [searchMode, setSearchMode] = useState<SearchMode>("hybrid");
  const [alpha, setAlpha] = useState(0.5);
  const [learnerStats, setLearnerStats] = useState<LearnerStats | null>(null);
  const [currentMode, setCurrentMode] = useState<SearchMode | null>(null);

  const isDark = resolvedTheme === "dark";
  const currentLogo = isDark ? logoLight : logoDark;

  // Fetch learner stats periodically
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await getLearnerStats();
        setLearnerStats(stats);
      } catch (e) {
        // Ignore errors
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    setResults([]);
    setCacheHit(null);
    setCurrentMode(null);
    try {
      if (searchMode === "hybrid") {
        const res = await qsearchHybrid(query, limit, alpha, true);
        setResults(res.results || []);
        setCurrentMode("hybrid");
      } else {
        const res = await qsearchSearch(query, limit);
        setResults(res.results || []);
        setCacheHit(Boolean(res.cache_hit));
        setCurrentMode("local");
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--bg-body)' }}>
      {/* Cyberpunk Background Grid Effect */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: isDark 
            ? 'linear-gradient(var(--accent-primary) 1px, transparent 1px), linear-gradient(90deg, var(--accent-primary) 1px, transparent 1px)'
            : 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        {/* Header with Logo and Auth */}
        <header className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between mb-16">
          <div className="flex items-center gap-4">
            <img
              src={currentLogo}
              alt="qsearch"
              className="h-14 transition-all duration-300 hover:scale-105"
              style={{ 
                filter: isDark 
                  ? 'drop-shadow(0 0 12px rgba(0, 191, 255, 0.6)) drop-shadow(0 0 24px rgba(57, 255, 20, 0.3))' 
                  : 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15))'
              }}
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Selector */}
            <select
              className="glass-panel px-4 py-2.5 text-sm font-medium rounded-lg outline-none transition-all duration-200 cursor-pointer hover:scale-105"
              style={{
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
                background: 'var(--bg-panel)',
              }}
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              aria-label="Theme"
            >
              <option value="system">🌐 System</option>
              <option value="light">☀️ Light</option>
              <option value="dark">🌙 Dark</option>
            </select>

            {/* Auth Button/Menu */}
            {authEnabled && !authLoading && (
              authenticated ? (
                <UserMenu />
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
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

        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h1 
            className="text-5xl md:text-6xl font-bold mb-6 tracking-tight"
            style={{ 
              color: 'var(--text-heading)',
              textShadow: isDark ? '0 0 20px rgba(0, 191, 255, 0.5), 0 0 40px rgba(57, 255, 20, 0.2)' : 'none'
            }}
          >
            Geometric Search Engine
          </h1>
          <p 
            className="text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-8"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
              Basin coordinate geometry
            </span>
            {" • "}
            {searchMode === "hybrid" ? "Web search + geometric re-ranking" : "Local-first search"}
            {" • "}
            <span className="font-semibold" style={{ color: 'var(--accent-secondary)' }}>
              Continuous learning
            </span>
          </p>

          {/* Search Mode Toggle */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
            <div 
              className="glass-panel inline-flex rounded-xl p-1"
              style={{ background: 'var(--bg-panel)' }}
            >
              <button
                onClick={() => setSearchMode("local")}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  searchMode === "local" ? "scale-105" : "opacity-60 hover:opacity-80"
                }`}
                style={{
                  background: searchMode === "local" ? 'var(--accent-primary)' : 'transparent',
                  color: searchMode === "local" ? 'var(--color-dark)' : 'var(--text-primary)',
                }}
              >
                🗄️ Local Index
              </button>
              <button
                onClick={() => setSearchMode("hybrid")}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  searchMode === "hybrid" ? "scale-105" : "opacity-60 hover:opacity-80"
                }`}
                style={{
                  background: searchMode === "hybrid" ? 'var(--accent-secondary)' : 'transparent',
                  color: searchMode === "hybrid" ? 'var(--color-dark)' : 'var(--text-primary)',
                }}
              >
                🌐 Hybrid Web
              </button>
            </div>

            {/* Alpha slider for hybrid mode */}
            {searchMode === "hybrid" && (
              <div className="flex items-center gap-3 glass-panel px-4 py-2 rounded-xl" style={{ background: 'var(--bg-panel)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  🎯 Geometry
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={alpha}
                  onChange={(e) => setAlpha(parseFloat(e.target.value))}
                  className="w-24 accent-current"
                  style={{ accentColor: 'var(--accent-secondary)' }}
                />
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  🔍 Serper
                </span>
                <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'var(--bg-input)', color: 'var(--accent-primary)' }}>
                  α={alpha.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Learner Stats Badge */}
          {learnerStats && (
            <div 
              className="inline-flex items-center gap-4 px-4 py-2 rounded-full text-sm"
              style={{ 
                background: 'var(--bg-panel)', 
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)'
              }}
            >
              <span className={learnerStats.running ? "animate-pulse" : ""}>
                {learnerStats.running ? "🟢" : "⚪"} Learner
              </span>
              <span>📚 {learnerStats.documents_added} docs</span>
              <span>📥 {learnerStats.queue_size} queued</span>
            </div>
          )}
        </div>

        {/* Search Form */}
        <main className="mt-12">
          <form onSubmit={onSearch} className="flex flex-col gap-4 sm:flex-row max-w-5xl mx-auto">
            <input
              className="glass-panel w-full flex-1 px-6 py-5 text-lg rounded-2xl outline-none transition-all duration-200 focus:scale-[1.02]"
              style={{
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
                background: 'var(--bg-panel)',
              }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the knowledge graph…"
              required
            />
            <input
              className="glass-panel w-full px-5 py-5 text-lg rounded-2xl outline-none transition-all duration-200 sm:w-32 text-center font-mono"
              style={{
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
                background: 'var(--bg-panel)',
              }}
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label="Result limit"
            />
            <button
              className="px-8 py-5 rounded-2xl font-bold text-lg transition-all duration-200 disabled:opacity-60 hover:scale-105 active:scale-95"
              style={{
                background: 'var(--accent-secondary)',
                color: 'var(--color-dark)',
                boxShadow: 'var(--button-shadow)',
              }}
              disabled={loading}
              type="submit"
            >
              {loading ? "Searching…" : "🔍 Search"}
            </button>
          </form>

          {/* Status Message */}
          <div className="mt-4 text-center text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {error ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'var(--bg-panel)', color: 'var(--accent-secondary)' }}>
                ⚠️ {error}
              </span>
            ) : currentMode === null ? (
              <span>&nbsp;</span>
            ) : currentMode === "hybrid" ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'var(--bg-panel)' }}>
                Mode: <span className="font-bold" style={{ color: 'var(--accent-secondary)' }}>🌐 Hybrid</span>
                <span className="mx-2">•</span>
                <span className="font-mono text-xs">α={alpha.toFixed(1)}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'var(--bg-panel)' }}>
                Mode: <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>🗄️ Local</span>
                {cacheHit !== null && (
                  <>
                    <span className="mx-2">•</span>
                    Cache: <span className="font-bold" style={{ color: cacheHit ? 'var(--accent-secondary)' : 'var(--accent-primary)' }}>
                      {cacheHit ? "✓ HIT" : "✗ MISS"}
                    </span>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Results */}
          <div className="mt-12 grid gap-6 max-w-5xl mx-auto">
            {loading ? (
              <div className="glass-panel p-10 rounded-2xl">
                <div className="h-6 w-48 animate-pulse rounded-lg mb-6" style={{ background: 'var(--bg-input)' }} />
                <div className="h-4 w-full animate-pulse rounded-lg mb-3" style={{ background: 'var(--bg-input)' }} />
                <div className="h-4 w-5/6 animate-pulse rounded-lg" style={{ background: 'var(--bg-input)' }} />
              </div>
            ) : results.length === 0 ? (
              <div className="glass-panel p-16 rounded-2xl text-center">
                <div 
                  className="text-6xl mb-6"
                  style={{ 
                    filter: isDark ? 'drop-shadow(0 0 20px rgba(57, 255, 20, 0.5))' : 'none'
                  }}
                >
                  🔍
                </div>
                <div className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                  No results yet
                </div>
                <div className="text-lg" style={{ color: 'var(--text-secondary)' }}>
                  Crawl some pages, then search by basin distance
                </div>
              </div>
            ) : (
              results.map((r, idx) => (
                <a
                  key={r.doc_id || r.url}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="glass-panel group block p-8 rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1"
                  style={{
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0 flex-1">
                      <div 
                        className="text-xl font-bold mb-2 group-hover:underline" 
                        style={{ 
                          color: 'var(--text-heading)',
                          textShadow: isDark ? '0 0 10px rgba(0, 191, 255, 0.3)' : 'none'
                        }}
                      >
                        {r.title || "(untitled)"}
                      </div>
                      <div className="truncate text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                        🔗 {r.url}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col gap-2 items-end">
                      {/* Show different metrics based on search mode */}
                      {currentMode === "hybrid" ? (
                        <>
                          <div
                            className="rounded-lg px-3 py-1 text-xs font-mono font-bold"
                            style={{
                              background: 'var(--bg-input)',
                              color: 'var(--accent-secondary)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            #{r.serper_position} Serper
                          </div>
                          <div
                            className="rounded-lg px-3 py-1 text-xs font-mono font-bold"
                            style={{
                              background: 'var(--bg-input)',
                              color: 'var(--accent-primary)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            d={Number(r.basin_distance || 0).toFixed(3)}
                          </div>
                          <div
                            className="rounded-lg px-3 py-1 text-xs font-mono font-bold"
                            style={{
                              background: isDark ? 'rgba(57, 255, 20, 0.2)' : 'rgba(0, 191, 255, 0.1)',
                              color: 'var(--text-heading)',
                              border: '2px solid var(--accent-secondary)',
                              boxShadow: isDark ? '0 0 8px rgba(57, 255, 20, 0.4)' : 'none'
                            }}
                          >
                            H={Number(r.hybrid_score || 0).toFixed(3)}
                          </div>
                        </>
                      ) : (
                        <div
                          className="rounded-xl px-4 py-2 text-sm font-mono font-bold"
                          style={{
                            background: 'var(--bg-input)',
                            color: 'var(--accent-primary)',
                            border: '2px solid var(--border-color)',
                            boxShadow: isDark ? '0 0 10px rgba(0, 191, 255, 0.3)' : 'none'
                          }}
                        >
                          d={Number(r.distance || 0).toFixed(4)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {r.snippet}
                  </div>
                </a>
              ))
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-24 pt-12 border-t text-center" style={{ borderColor: 'var(--border-color)' }}>
          <p className="text-base mb-4" style={{ color: 'var(--text-secondary)' }}>
            Powered by{" "}
            <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
              basin coordinate geometry
            </span>
            {" • "}
            Built with{" "}
            <span style={{ color: 'var(--accent-secondary)' }}>♥</span>
            {" "}for local-first search
          </p>
          <p className="text-sm" style={{ color: 'var(--text-disabled)' }}>
            © 2025 qsearch • Privacy-focused • No tracking
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
