import React, { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeProvider";

interface ApiKey {
  id: number;
  name: string;
  instance_type: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  rate_limit: number;
  is_active: boolean;
}

interface FederatedInstance {
  id: number;
  name: string;
  endpoint: string;
  status: string;
  capabilities: string[];
  sync_direction: string;
  last_sync_at: string | null;
  created_at: string;
}

interface SyncStatus {
  is_connected: boolean;
  peer_count: number;
  last_sync_time: string | null;
  pending_packets: number;
  sync_mode: string;
}

interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
  capabilities: string[];
}

interface ApiTestResult {
  success: boolean;
  status: number;
  data?: unknown;
  error?: string;
  latency: number;
}

type Tab = "keys" | "instances" | "sync" | "test";

function apiBase(): string {
  const base = (import.meta as any).env?.VITE_QSEARCH_API_BASE;
  if (!base) return "";
  return String(base).replace(/\/+$/, "");
}

export function Federation() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [activeTab, setActiveTab] = useState<Tab>("keys");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [instances, setInstances] = useState<FederatedInstance[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Create key state
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyType, setNewKeyType] = useState("external");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Test API state
  const [testEndpoint, setTestEndpoint] = useState("/health");
  const [testResult, setTestResult] = useState<ApiTestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const base = apiBase();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [healthRes, keysRes, instancesRes, syncRes] = await Promise.all([
        fetch(`${base}/federation/health`).then(r => r.json()).catch(() => null),
        fetch(`${base}/federation/keys`).then(r => r.json()).catch(() => ({ keys: [] })),
        fetch(`${base}/federation/instances`).then(r => r.json()).catch(() => ({ instances: [] })),
        fetch(`${base}/federation/sync/status`).then(r => r.json()).catch(() => null),
      ]);
      setHealth(healthRes);
      setApiKeys(keysRes.keys || []);
      setInstances(instancesRes.instances || []);
      setSyncStatus(syncRes);
    } catch (e) {
      console.error("Failed to fetch federation data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const createKey = async () => {
    if (!newKeyName) return;
    setCreateLoading(true);
    try {
      const res = await fetch(`${base}/federation/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          instance_type: newKeyType,
          scopes: ["read", "write", "search", "hybrid", "sync", "crawl"],
          rate_limit: 120,
        }),
      });
      const data = await res.json();
      if (data.key) {
        setCreatedKey(data.key);
        setNewKeyName("");
        fetchAll();
      }
    } catch (e) {
      console.error("Failed to create key:", e);
    } finally {
      setCreateLoading(false);
    }
  };

  const revokeKey = async (keyId: number) => {
    try {
      await fetch(`${base}/federation/keys/${keyId}`, { method: "DELETE" });
      fetchAll();
    } catch (e) {
      console.error("Failed to revoke key:", e);
    }
  };

  const testApi = async () => {
    setTestLoading(true);
    const start = Date.now();
    try {
      const res = await fetch(`${base}/api/v1/external${testEndpoint}`);
      const latency = Date.now() - start;
      const data = await res.json();
      setTestResult({ success: res.ok, status: res.status, data, latency });
    } catch (e) {
      setTestResult({
        success: false,
        status: 0,
        error: e instanceof Error ? e.message : "Request failed",
        latency: Date.now() - start,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const testEndpoints = [
    { value: "/health", label: "Health Check" },
    { value: "/sync/status", label: "Sync Status" },
    { value: "/basin/query?query=test&limit=5", label: "Basin Query" },
  ];

  const tabStyle = (tab: Tab) => ({
    background: activeTab === tab ? "var(--accent-primary)" : "transparent",
    color: activeTab === tab ? "var(--color-dark)" : "var(--text-primary)",
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-body)" }}>
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <a
              href="#/"
              className="text-sm font-medium mb-2 inline-block hover:underline"
              style={{ color: "var(--accent-primary)" }}
            >
              ← Back to Search
            </a>
            <h1
              className="text-3xl font-bold flex items-center gap-3"
              style={{ color: "var(--text-heading)" }}
            >
              🌐 Federation Dashboard
            </h1>
            <p style={{ color: "var(--text-secondary)" }}>
              Connect and synchronize with other QIG constellations
            </p>
          </div>
          <button
            onClick={fetchAll}
            className="px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
            style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
          >
            🔄 Refresh All
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel p-4 rounded-xl" style={{ background: "var(--bg-panel)" }}>
            <div className="flex items-center gap-3">
              <span className={health?.status === "healthy" ? "text-green-500" : "text-yellow-500"}>⚡</span>
              <div>
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>API Status</div>
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {loading ? "Loading..." : health?.status ?? "Unknown"}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl" style={{ background: "var(--bg-panel)" }}>
            <div className="flex items-center gap-3">
              <span style={{ color: "var(--accent-primary)" }}>🔑</span>
              <div>
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>API Keys</div>
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {apiKeys.filter(k => k.is_active).length} active
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl" style={{ background: "var(--bg-panel)" }}>
            <div className="flex items-center gap-3">
              <span style={{ color: "var(--accent-secondary)" }}>🖥️</span>
              <div>
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Connected Peers</div>
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {syncStatus?.peer_count ?? 0} instances
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl" style={{ background: "var(--bg-panel)" }}>
            <div className="flex items-center gap-3">
              <span className={syncStatus?.is_connected ? "text-green-500" : "text-gray-400"}>📡</span>
              <div>
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Sync Status</div>
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {syncStatus?.is_connected ? "Connected" : "Standalone"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="glass-panel rounded-xl p-1 mb-6 inline-flex" style={{ background: "var(--bg-panel)" }}>
          {[
            { id: "keys" as Tab, label: "🔑 API Keys" },
            { id: "instances" as Tab, label: "🖥️ Connected Instances" },
            { id: "sync" as Tab, label: "🔗 Basin Sync" },
            { id: "test" as Tab, label: "⚡ API Tester" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-5 py-2.5 rounded-lg font-medium transition-all"
              style={tabStyle(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "keys" && (
            <>
              {/* Create Key */}
              <div className="glass-panel p-6 rounded-xl" style={{ background: "var(--bg-panel)" }}>
                <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>
                  🛡️ Create Unified API Key
                </h2>
                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                  One key per external system - includes all capabilities (search, hybrid, sync, crawl)
                </p>

                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Instance Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., research-node-alpha"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg outline-none"
                      style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                    />
                  </div>
                  <div className="w-48">
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Instance Type
                    </label>
                    <select
                      value={newKeyType}
                      onChange={(e) => setNewKeyType(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg outline-none"
                      style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                    >
                      <option value="external">External System</option>
                      <option value="headless">Headless Client</option>
                      <option value="federation">Federation Node</option>
                      <option value="research">Research Instance</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={createKey}
                      disabled={!newKeyName || createLoading}
                      className="px-6 py-2.5 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50"
                      style={{ background: "var(--accent-secondary)", color: "var(--color-dark)" }}
                    >
                      {createLoading ? "Creating..." : "➕ Create Key"}
                    </button>
                  </div>
                </div>

                {createdKey && (
                  <div className="mt-4 p-4 rounded-lg" style={{ background: "rgba(57, 255, 20, 0.1)", border: "1px solid rgba(57, 255, 20, 0.3)" }}>
                    <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                      ✅ API Key Created - Save This Now!
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 rounded text-sm font-mono" style={{ background: "var(--bg-body)", color: "var(--accent-primary)" }}>
                        {createdKey}
                      </code>
                      <button
                        onClick={() => copyToClipboard(createdKey)}
                        className="px-3 py-2 rounded-lg"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}
                      >
                        📋
                      </button>
                    </div>
                    <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                      This key will not be shown again. Store it securely.
                    </p>
                  </div>
                )}
              </div>

              {/* Active Keys */}
              <div className="glass-panel p-6 rounded-xl" style={{ background: "var(--bg-panel)" }}>
                <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-heading)" }}>
                  Active API Keys
                </h2>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-8" style={{ color: "var(--text-secondary)" }}>
                    No API keys created yet. Create one above to allow external systems to connect.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between p-4 rounded-lg"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{key.name}</span>
                            <span className="px-2 py-0.5 text-xs rounded" style={{ background: "var(--bg-panel)", color: "var(--text-secondary)" }}>
                              {key.instance_type}
                            </span>
                            <span
                              className="px-2 py-0.5 text-xs rounded"
                              style={{
                                background: key.is_active ? "rgba(57, 255, 20, 0.2)" : "rgba(128, 128, 128, 0.2)",
                                color: key.is_active ? "#39ff14" : "gray",
                              }}
                            >
                              {key.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div className="text-sm flex items-center gap-4" style={{ color: "var(--text-secondary)" }}>
                            <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                            <span>{key.rate_limit} req/min</span>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {key.scopes.map((scope) => (
                              <span key={scope} className="px-2 py-0.5 text-xs rounded" style={{ background: "var(--bg-panel)", color: "var(--accent-primary)" }}>
                                {scope}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => revokeKey(key.id)}
                          className="px-3 py-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "instances" && (
            <div className="glass-panel p-6 rounded-xl" style={{ background: "var(--bg-panel)" }}>
              <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-heading)" }}>
                🖥️ Connected QIG Instances
              </h2>
              {instances.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="text-6xl">🌐</div>
                  <div>
                    <div className="font-semibold" style={{ color: "var(--text-primary)" }}>No Connected Instances</div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      Share your API endpoint and key with other QIG systems to establish connections
                    </p>
                  </div>
                  <div className="p-4 rounded-lg max-w-md mx-auto" style={{ background: "var(--bg-input)" }}>
                    <div className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Your Federation Endpoint:</div>
                    <code className="text-xs break-all" style={{ color: "var(--accent-primary)" }}>
                      {base}/api/v1/external
                    </code>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {instances.map((instance) => (
                    <div key={instance.id} className="p-4 rounded-lg space-y-2" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{instance.name}</span>
                          <span
                            className="px-2 py-0.5 text-xs rounded"
                            style={{
                              background: instance.status === "active" ? "rgba(57, 255, 20, 0.2)" : "rgba(255, 193, 7, 0.2)",
                              color: instance.status === "active" ? "#39ff14" : "#ffc107",
                            }}
                          >
                            {instance.status}
                          </span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--bg-panel)", color: "var(--text-secondary)" }}>
                          {instance.sync_direction}
                        </span>
                      </div>
                      <code className="text-sm" style={{ color: "var(--text-secondary)" }}>{instance.endpoint}</code>
                      {instance.last_sync_at && (
                        <div className="text-xs" style={{ color: "var(--text-disabled)" }}>
                          Last sync: {new Date(instance.last_sync_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "sync" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-xl" style={{ background: "var(--bg-panel)" }}>
                <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-heading)" }}>
                  🗄️ Basin Sync Status
                </h2>
                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                  Real-time synchronization of 256D basin coordinates across instances
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                    <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Connection</div>
                    <div className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                      {syncStatus?.is_connected ? "✅ Connected" : "❌ Disconnected"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                    <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Sync Mode</div>
                    <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {syncStatus?.sync_mode ?? "Unknown"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                    <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Pending Packets</div>
                    <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {syncStatus?.pending_packets ?? 0}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
                    <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Last Sync</div>
                    <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      {syncStatus?.last_sync_time ? new Date(syncStatus.last_sync_time).toLocaleString() : "Never"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-xl" style={{ background: "var(--bg-panel)" }}>
                <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-heading)" }}>
                  Sync Packet Structure
                </h2>
                <div className="space-y-2 text-sm">
                  {[
                    { badge: "256D", label: "Basin Coordinates" },
                    { badge: "URL", label: "Document URL" },
                    { badge: "Title", label: "Document Title" },
                    { badge: "Snippet", label: "Text Snippet" },
                    { badge: "Dist", label: "Basin Distance" },
                    { badge: "Meta", label: "Crawl Metadata" },
                  ].map((item) => (
                    <div key={item.badge} className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: "var(--bg-input)", color: "var(--accent-primary)" }}>
                        {item.badge}
                      </span>
                      <span style={{ color: "var(--text-primary)" }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "test" && (
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-xl" style={{ background: "var(--bg-panel)" }}>
                <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-heading)" }}>
                  ⚡ API Endpoint Tester
                </h2>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Endpoint
                    </label>
                    <select
                      value={testEndpoint}
                      onChange={(e) => setTestEndpoint(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg outline-none"
                      style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                    >
                      {testEndpoints.map((ep) => (
                        <option key={ep.value} value={ep.value}>
                          {ep.label} ({ep.value})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={testApi}
                      disabled={testLoading}
                      className="px-6 py-2.5 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50"
                      style={{ background: "var(--accent-primary)", color: "var(--color-dark)" }}
                    >
                      {testLoading ? "Testing..." : "📤 Send Request"}
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-4">
                      <span
                        className="px-2 py-0.5 rounded text-sm font-medium"
                        style={{
                          background: testResult.success ? "rgba(57, 255, 20, 0.2)" : "rgba(255, 0, 0, 0.2)",
                          color: testResult.success ? "#39ff14" : "#ff4444",
                        }}
                      >
                        {testResult.success ? "Success" : "Failed"}
                      </span>
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        Status: {testResult.status} | Latency: {testResult.latency}ms
                      </span>
                    </div>
                    <div className="p-4 rounded-lg overflow-auto max-h-[300px]" style={{ background: "var(--bg-input)" }}>
                      <pre className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {JSON.stringify(testResult.data ?? testResult.error, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="glass-panel p-6 rounded-xl" style={{ background: "var(--bg-panel)" }}>
                <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-heading)" }}>
                  API Documentation
                </h2>
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Base URL</div>
                  <code className="p-2 rounded text-sm block" style={{ background: "var(--bg-input)", color: "var(--accent-primary)" }}>
                    {base}/api/v1/external
                  </code>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Search</div>
                    <ul className="space-y-1" style={{ color: "var(--text-secondary)" }}>
                      <li>POST /basin/query</li>
                      <li>POST /hybrid/search</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Sync</div>
                    <ul className="space-y-1" style={{ color: "var(--text-secondary)" }}>
                      <li>GET /sync/status</li>
                      <li>GET /sync/export</li>
                      <li>POST /sync/import</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Health</div>
                    <ul className="space-y-1" style={{ color: "var(--text-secondary)" }}>
                      <li>GET /health</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Learner</div>
                    <ul className="space-y-1" style={{ color: "var(--text-secondary)" }}>
                      <li>GET /learner/stats</li>
                      <li>POST /learner/queue</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
