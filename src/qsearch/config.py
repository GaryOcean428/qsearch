from __future__ import annotations

import os
from dataclasses import dataclass


def _normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def _parse_int(v: str | None, default: int) -> int:
    if not v:
        return default
    try:
        return int(v)
    except ValueError:
        return default


def _parse_csv(v: str | None) -> list[str]:
    if not v:
        return []
    return [x.strip() for x in v.split(",") if x.strip()]


@dataclass(frozen=True)
class QSearchConfig:
    db_url: str
    redis_url: str | None
    cache_ttl_seconds: int
    cors_allow_origins: list[str]

    @staticmethod
    def from_env() -> "QSearchConfig":
        raw_db = (
            os.environ.get("DATABASE_URL")
            or os.environ.get("QSEARCH_DB_URL")
            or "sqlite:///data/qsearch.db"
        )
        db_url = _normalize_db_url(raw_db)

        redis_url = os.environ.get("REDIS_URL")
        cache_ttl_seconds = _parse_int(
            os.environ.get("QSEARCH_CACHE_TTL_SECONDS")
            or os.environ.get("CACHE_TTL_SECONDS"),
            3600,
        )

        cors_allow_origins = _parse_csv(os.environ.get("QSEARCH_CORS_ALLOW_ORIGINS"))

        return QSearchConfig(
            db_url=db_url,
            redis_url=redis_url,
            cache_ttl_seconds=max(0, cache_ttl_seconds),
            cors_allow_origins=cors_allow_origins,
        )
