type SearchResponse = {
  query: string;
  count: number;
  cache_hit?: boolean;
  results: Array<{
    doc_id: string;
    url: string;
    title: string;
    snippet: string;
    distance: number;
  }>;
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
  return (await res.json()) as SearchResponse;
}
