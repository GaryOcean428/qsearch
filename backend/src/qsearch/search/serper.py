"""
Serper.dev search integration for hybrid web search.
"""

from __future__ import annotations

import os
import hashlib
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

_log = logging.getLogger("qsearch.serper")


@dataclass(frozen=True)
class SerperResult:
    title: str
    url: str
    snippet: str
    position: int


@dataclass(frozen=True)
class SerperResponse:
    query: str
    results: list[SerperResult]
    search_time: float


class SerperClient:
    """Client for Serper.dev Google Search API."""

    BASE_URL = "https://google.serper.dev/search"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("SERPER_API_KEY", "")
        if not self.api_key:
            _log.warning("SERPER_API_KEY not set - web search disabled")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def search(
        self,
        query: str,
        *,
        num_results: int = 10,
        country: str = "us",
        language: str = "en",
    ) -> SerperResponse:
        """Search the web using Serper API."""
        if not self.enabled:
            return SerperResponse(query=query, results=[], search_time=0.0)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.BASE_URL,
                    headers={
                        "X-API-KEY": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "q": query,
                        "num": num_results,
                        "gl": country,
                        "hl": language,
                    },
                )
                response.raise_for_status()
                data = response.json()

                results = []
                organic = data.get("organic", [])
                for i, item in enumerate(organic[:num_results]):
                    results.append(
                        SerperResult(
                            title=item.get("title", ""),
                            url=item.get("link", ""),
                            snippet=item.get("snippet", ""),
                            position=i + 1,
                        )
                    )

                search_time = data.get("searchParameters", {}).get("timeUsed", 0.0)
                return SerperResponse(
                    query=query,
                    results=results,
                    search_time=float(search_time) if search_time else 0.0,
                )

        except httpx.HTTPStatusError as e:
            _log.error("Serper API error: %s", e)
            return SerperResponse(query=query, results=[], search_time=0.0)
        except Exception as e:
            _log.error("Serper search failed: %s", e)
            return SerperResponse(query=query, results=[], search_time=0.0)

    def search_sync(
        self,
        query: str,
        *,
        num_results: int = 10,
        country: str = "us",
        language: str = "en",
    ) -> SerperResponse:
        """Synchronous version of search."""
        if not self.enabled:
            return SerperResponse(query=query, results=[], search_time=0.0)

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    self.BASE_URL,
                    headers={
                        "X-API-KEY": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "q": query,
                        "num": num_results,
                        "gl": country,
                        "hl": language,
                    },
                )
                response.raise_for_status()
                data = response.json()

                results = []
                organic = data.get("organic", [])
                for i, item in enumerate(organic[:num_results]):
                    results.append(
                        SerperResult(
                            title=item.get("title", ""),
                            url=item.get("link", ""),
                            snippet=item.get("snippet", ""),
                            position=i + 1,
                        )
                    )

                search_time = data.get("searchParameters", {}).get("timeUsed", 0.0)
                return SerperResponse(
                    query=query,
                    results=results,
                    search_time=float(search_time) if search_time else 0.0,
                )

        except Exception as e:
            _log.error("Serper search failed: %s", e)
            return SerperResponse(query=query, results=[], search_time=0.0)
