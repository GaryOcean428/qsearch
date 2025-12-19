from __future__ import annotations

import asyncio
import hashlib
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from qsearch.api.deps import get_cache, get_config, get_orchestrator
from qsearch.api.auth import router as auth_router
from qsearch.api.routes_v1 import router as v1_router
from qsearch.api.federation import router as federation_router, external_router
from qsearch.search.hybrid import HybridSearchOrchestrator
from qsearch.search.learner import get_learner

_log = logging.getLogger("qsearch.api")

# Singleton instances
_hybrid_orchestrator: Optional[HybridSearchOrchestrator] = None


def get_hybrid_orchestrator() -> HybridSearchOrchestrator:
    global _hybrid_orchestrator
    if _hybrid_orchestrator is None:
        cfg = get_config()
        _hybrid_orchestrator = HybridSearchOrchestrator(
            serper_api_key=cfg.serper_api_key,
            fetch_content=True,
            max_fetch=15,
        )
    return _hybrid_orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: start continuous learner
    cfg = get_config()
    learner = get_learner(db_url=cfg.db_url)
    await learner.start()
    _log.info("Continuous learner started")
    yield
    # Shutdown
    await learner.stop()
    _log.info("Continuous learner stopped")


app = FastAPI(title="qsearch", version="0.2.0", lifespan=lifespan)

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
if _cfg.session_secret:
    app.include_router(auth_router)
app.include_router(v1_router)
app.include_router(federation_router)
app.include_router(external_router)


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


# === Hybrid Search Endpoints ===


class HybridSearchRequest(BaseModel):
    query: str
    limit: int = 10
    alpha: float = 0.5  # Weight: 0=pure basin, 1=pure serper rank
    learn: bool = True  # Queue results for background learning


@app.post("/hybrid")
async def hybrid_search(req: HybridSearchRequest, background_tasks: BackgroundTasks):
    """
    Hybrid search combining Serper web results with basin geometry re-ranking.
    """
    qh = hashlib.sha256(req.query.encode()).hexdigest()[:12]
    orchestrator = get_hybrid_orchestrator()

    results = await orchestrator.search(req.query, limit=req.limit, alpha=req.alpha)

    # Queue URLs for background learning
    if req.learn and results:
        cfg = get_config()
        learner = get_learner(db_url=cfg.db_url)
        queued = learner.queue_from_hybrid_results(results)
        _log.info(
            "hybrid qh=%s count=%s queued_for_learning=%s", qh, len(results), queued
        )

    return {
        "query": req.query,
        "count": len(results),
        "mode": "hybrid",
        "alpha": req.alpha,
        "results": [
            {
                "url": r.url,
                "title": r.title,
                "snippet": r.snippet,
                "serper_position": r.serper_position,
                "basin_distance": r.basin_distance,
                "hybrid_score": r.hybrid_score,
            }
            for r in results
        ],
    }


@app.post("/api/hybrid")
async def hybrid_search_alias(
    req: HybridSearchRequest, background_tasks: BackgroundTasks
):
    return await hybrid_search(req, background_tasks)


# === Learner Stats Endpoint ===


@app.get("/learner/stats")
def learner_stats():
    """Get continuous learner statistics."""
    cfg = get_config()
    learner = get_learner(db_url=cfg.db_url)
    return learner.get_stats()


@app.get("/api/learner/stats")
def learner_stats_alias():
    return learner_stats()
