from __future__ import annotations

import hashlib
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from qsearch.api.deps import get_cache, get_config, get_orchestrator
from qsearch.api.auth import router as auth_router
from qsearch.api.routes_v1 import router as v1_router

app = FastAPI(title="qsearch", version="0.1.0")
_log = logging.getLogger("qsearch.api")

_cfg = get_config()
if _cfg.session_secret:
    app.add_middleware(SessionMiddleware, secret_key=_cfg.session_secret)
if _cfg.cors_allow_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cfg.cors_allow_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(v1_router, prefix="/api/v1")
app.include_router(auth_router)


class SearchRequest(BaseModel):
    query: str
    limit: int = 10


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/search")
def search(req: SearchRequest):
    qh = hashlib.sha256(req.query.encode()).hexdigest()[:12]
    orchestrator = get_orchestrator()
    cache = get_cache()
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

    results = orchestrator.search(req.query, limit=req.limit)
    payload = {
        "query": req.query,
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
    _log.info(
        "search cache_hit=0 cache_enabled=%s qh=%s limit=%s count=%s",
        cache.enabled,
        qh,
        req.limit,
        payload.get("count"),
    )
    cache.set(req.query, req.limit, payload)
    return payload


@app.get("/api/health")
def health_alias() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/search")
def search_alias(req: SearchRequest):
    return search(req)
