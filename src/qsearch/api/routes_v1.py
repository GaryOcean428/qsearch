from __future__ import annotations

import hashlib
import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from qsearch.cache import SearchCache
from qsearch.api.deps import get_cache, get_orchestrator
from qsearch.search.orchestrator import SearchOrchestrator

router = APIRouter(prefix="/api/v1")
_log = logging.getLogger("qsearch.api")


class SearchRequest(BaseModel):
    query: str
    limit: int = 10


def _search_payload(
    orchestrator: SearchOrchestrator, query: str, limit: int
) -> dict[str, Any]:
    results = orchestrator.search(query, limit=limit)
    return {
        "query": query,
        "count": len(results),
        "cache_hit": False,
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


@router.get("/health")
def health_v1() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/search")
def search_v1(
    req: SearchRequest,
    orchestrator: SearchOrchestrator = Depends(get_orchestrator),
    cache: SearchCache = Depends(get_cache),
):
    qh = hashlib.sha256(req.query.encode()).hexdigest()[:12]

    cached = cache.get(req.query, req.limit)
    if cached is not None:
        _log.info(
            "search cache_hit=1 cache_enabled=%s qh=%s limit=%s count=%s",
            cache.enabled,
            qh,
            req.limit,
            cached.get("count"),
        )
        cached["cache_hit"] = True
        return cached

    payload = _search_payload(orchestrator, req.query, req.limit)
    _log.info(
        "search cache_hit=0 cache_enabled=%s qh=%s limit=%s count=%s",
        cache.enabled,
        qh,
        req.limit,
        payload.get("count"),
    )
    cache.set(req.query, req.limit, payload)
    return payload
