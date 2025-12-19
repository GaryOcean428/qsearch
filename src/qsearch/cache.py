from __future__ import annotations

import hashlib
import json
from typing import Any

import redis


def _cache_key(query: str, limit: int) -> str:
    h = hashlib.sha256(f"{query}\n{limit}".encode()).hexdigest()
    return f"qsearch:search:{h}"


class SearchCache:
    def __init__(self, *, redis_url: str | None, ttl_seconds: int) -> None:
        self._enabled = bool(redis_url)
        self._ttl = max(0, int(ttl_seconds))
        self._client = redis.Redis.from_url(redis_url) if redis_url else None

    @property
    def enabled(self) -> bool:
        return self._enabled and self._client is not None and self._ttl > 0

    def get(self, query: str, limit: int) -> dict[str, Any] | None:
        if not self.enabled:
            return None
        try:
            raw = self._client.get(_cache_key(query, limit))
            if not raw:
                return None
            return json.loads(raw)
        except Exception:
            return None

    def set(self, query: str, limit: int, payload: dict[str, Any]) -> None:
        if not self.enabled:
            return
        try:
            self._client.setex(_cache_key(query, limit), self._ttl, json.dumps(payload))
        except Exception:
            return
