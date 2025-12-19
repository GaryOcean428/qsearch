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
    public_base_url: str | None
    session_secret: str | None
    google_client_id: str | None
    google_client_secret: str | None
    microsoft_client_id: str | None
    microsoft_client_secret: str | None
    serper_api_key: str | None
    bing_api_key: str | None

    @property
    def auth_enabled(self) -> bool:
        return bool(
            self.public_base_url
            and self.session_secret
            and (
                (self.google_client_id and self.google_client_secret)
                or (self.microsoft_client_id and self.microsoft_client_secret)
            )
        )

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

        public_base_url = os.environ.get("QSEARCH_PUBLIC_BASE_URL")
        session_secret = os.environ.get("QSEARCH_SESSION_SECRET")

        google_client_id = os.environ.get("GOOGLE_CLIENT_ID")
        google_client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")

        microsoft_client_id = os.environ.get("MICROSOFT_CLIENT_ID")
        microsoft_client_secret = os.environ.get("MICROSOFT_CLIENT_SECRET")

        serper_api_key = os.environ.get("SERPER_API_KEY")
        bing_api_key = os.environ.get("BING_SEARCH_API")

        return QSearchConfig(
            db_url=db_url,
            redis_url=redis_url,
            cache_ttl_seconds=max(0, cache_ttl_seconds),
            cors_allow_origins=cors_allow_origins,
            public_base_url=public_base_url,
            session_secret=session_secret,
            google_client_id=google_client_id,
            google_client_secret=google_client_secret,
            microsoft_client_id=microsoft_client_id,
            microsoft_client_secret=microsoft_client_secret,
            serper_api_key=serper_api_key,
            bing_api_key=bing_api_key,
        )
