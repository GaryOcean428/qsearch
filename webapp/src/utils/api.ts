type SearchResult = {
  doc_id?: string;
  url: string;
  title: string;
  snippet: string;
  distance?: number;
  basin_distance?: number;
  hybrid_score?: number;
  serper_position?: number;
};

type SearchResponse = {
  query: string;
  count: number;
  cache_hit?: boolean;
  mode?: "local" | "hybrid";
  alpha?: number;
  results: SearchResult[];
};

type LearnerStats = {
  urls_queued: number;
  urls_crawled: number;
  urls_failed: number;
  documents_added: number;
  queue_size: number;
  last_crawl_time: string | null;
  running: boolean;
};

function apiBase(): string {
  const base = (import.meta as any).env?.VITE_QSEARCH_API_BASE;
  if (!base) return "";
  return String(base).replace(/\/+$/, "");
}

export async function qsearchSearch(query: string, limit: number): Promise<SearchResponse> {
  const base = apiBase();
  const res = await fetch(`${base}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`qsearch API error: ${res.status} ${body}`);
  }
  const data = await res.json();
  return { ...data, mode: "local" } as SearchResponse;
}

export async function qsearchHybrid(
  query: string,
  limit: number,
  alpha: number = 0.5,
  learn: boolean = true
): Promise<SearchResponse> {
  const base = apiBase();
  const res = await fetch(`${base}/hybrid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, alpha, learn }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`qsearch hybrid API error: ${res.status} ${body}`);
  }
  return (await res.json()) as SearchResponse;
}

export async function getLearnerStats(): Promise<LearnerStats> {
  const base = apiBase();
  const res = await fetch(`${base}/learner/stats`);
  if (!res.ok) {
    throw new Error(`Failed to get learner stats: ${res.status}`);
  }
  return (await res.json()) as LearnerStats;
}

export type { SearchResponse, SearchResult, LearnerStats };
