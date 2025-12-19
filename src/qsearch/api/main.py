from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

from qsearch.search.orchestrator import SearchOrchestrator

app = FastAPI(title="qsearch", version="0.1.0")
orchestrator = SearchOrchestrator()


class SearchRequest(BaseModel):
    query: str
    limit: int = 10


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/search")
def search(req: SearchRequest):
    results = orchestrator.search(req.query, limit=req.limit)
    return {
        "query": req.query,
        "count": len(results),
        "results": [
            {
                "doc_id": r.doc_id,
                "url": r.url,
                "title": r.title,
                "snippet": r.snippet,
                "distance": r.distance,
            }
            for r in results
        ],
    }
