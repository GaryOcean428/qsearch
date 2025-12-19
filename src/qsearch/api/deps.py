from __future__ import annotations

from functools import lru_cache

from qsearch.cache import SearchCache
from qsearch.config import QSearchConfig
from qsearch.search.orchestrator import SearchOrchestrator


@lru_cache
def get_config() -> QSearchConfig:
    return QSearchConfig.from_env()


@lru_cache
def get_orchestrator() -> SearchOrchestrator:
    cfg = get_config()
    return SearchOrchestrator(db_url=cfg.db_url)


@lru_cache
def get_cache() -> SearchCache:
    cfg = get_config()
    return SearchCache(redis_url=cfg.redis_url, ttl_seconds=cfg.cache_ttl_seconds)
