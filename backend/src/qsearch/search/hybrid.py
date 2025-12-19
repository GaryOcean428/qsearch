"""
Hybrid search orchestrator combining Serper web search with basin geometry re-ranking.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import dataclass
from typing import Optional

import httpx
from bs4 import BeautifulSoup

from qsearch.core.encoding import encode_text_to_basin
from qsearch.core.metrics import basin_distance
from qsearch.search.serper import SerperClient, SerperResult

_log = logging.getLogger("qsearch.hybrid")


@dataclass(frozen=True)
class HybridResult:
    url: str
    title: str
    snippet: str
    content: str
    serper_position: int
    basin_distance: float
    hybrid_score: float


class HybridSearchOrchestrator:
    """
    Combines web search (Serper) with geometric basin re-ranking.

    Flow:
    1. Query Serper for web results
    2. Fetch page content for top results
    3. Encode content to basin vectors
    4. Re-rank by basin distance to query
    5. Return hybrid-scored results
    """

    def __init__(
        self,
        serper_api_key: Optional[str] = None,
        fetch_content: bool = True,
        max_fetch: int = 10,
    ):
        self.serper = SerperClient(api_key=serper_api_key)
        self.fetch_content = fetch_content
        self.max_fetch = max_fetch

    async def search(
        self,
        query: str,
        *,
        limit: int = 10,
        alpha: float = 0.5,  # Weight for serper rank vs basin distance
    ) -> list[HybridResult]:
        """
        Perform hybrid search.

        Args:
            query: Search query
            limit: Number of results to return
            alpha: Blending factor (0=pure basin, 1=pure serper rank)

        Returns:
            List of hybrid results sorted by hybrid_score
        """
        # 1. Get web results from Serper
        serper_response = await self.serper.search(query, num_results=self.max_fetch)

        if not serper_response.results:
            _log.info("No Serper results for query: %s", query)
            return []

        # 2. Encode query to basin
        query_basin = encode_text_to_basin(query)

        # 3. Fetch and process results
        results = []

        if self.fetch_content:
            # Fetch content in parallel
            fetch_tasks = [
                self._fetch_and_encode(r, query_basin)
                for r in serper_response.results[: self.max_fetch]
            ]
            fetched = await asyncio.gather(*fetch_tasks, return_exceptions=True)

            for i, result in enumerate(fetched):
                if isinstance(result, Exception):
                    _log.debug(
                        "Failed to fetch %s: %s", serper_response.results[i].url, result
                    )
                    continue
                if result is not None:
                    results.append(result)
        else:
            # Use snippets only
            for r in serper_response.results:
                content = r.snippet
                content_basin = encode_text_to_basin(content)
                dist = basin_distance(query_basin, content_basin)

                results.append(
                    HybridResult(
                        url=r.url,
                        title=r.title,
                        snippet=r.snippet,
                        content=content,
                        serper_position=r.position,
                        basin_distance=dist,
                        hybrid_score=0.0,  # Will compute below
                    )
                )

        if not results:
            return []

        # 4. Compute hybrid scores
        # Normalize serper position to 0-1 (lower is better)
        max_pos = max(r.serper_position for r in results)
        # Normalize basin distance to 0-1 (lower is better)
        max_dist = max(r.basin_distance for r in results) or 1.0

        scored_results = []
        for r in results:
            pos_score = r.serper_position / max_pos  # 0-1, lower is better
            dist_score = r.basin_distance / max_dist  # 0-1, lower is better

            # Hybrid score: weighted combination (lower is better)
            hybrid = alpha * pos_score + (1 - alpha) * dist_score

            scored_results.append(
                HybridResult(
                    url=r.url,
                    title=r.title,
                    snippet=r.snippet,
                    content=r.content,
                    serper_position=r.serper_position,
                    basin_distance=r.basin_distance,
                    hybrid_score=hybrid,
                )
            )

        # 5. Sort by hybrid score and return top results
        scored_results.sort(key=lambda x: x.hybrid_score)
        return scored_results[:limit]

    async def _fetch_and_encode(
        self,
        serper_result: SerperResult,
        query_basin,
    ) -> Optional[HybridResult]:
        """Fetch page content and compute basin distance."""
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(
                    serper_result.url,
                    headers={"User-Agent": "qsearch/1.0"},
                )
                response.raise_for_status()

                # Parse HTML
                soup = BeautifulSoup(response.content, "lxml")
                for tag in soup(["script", "style", "nav", "footer", "header"]):
                    tag.decompose()

                text = soup.get_text(separator=" ", strip=True)[:5000]

                # Encode to basin
                content_basin = encode_text_to_basin(text)
                dist = basin_distance(query_basin, content_basin)

                return HybridResult(
                    url=serper_result.url,
                    title=serper_result.title,
                    snippet=serper_result.snippet,
                    content=text[:500],
                    serper_position=serper_result.position,
                    basin_distance=dist,
                    hybrid_score=0.0,
                )

        except Exception as e:
            _log.debug("Failed to fetch %s: %s", serper_result.url, e)
            # Fall back to snippet
            content_basin = encode_text_to_basin(serper_result.snippet)
            dist = basin_distance(query_basin, content_basin)

            return HybridResult(
                url=serper_result.url,
                title=serper_result.title,
                snippet=serper_result.snippet,
                content=serper_result.snippet,
                serper_position=serper_result.position,
                basin_distance=dist,
                hybrid_score=0.0,
            )

    def search_sync(
        self,
        query: str,
        *,
        limit: int = 10,
        alpha: float = 0.5,
    ) -> list[HybridResult]:
        """Synchronous wrapper for search."""
        return asyncio.run(self.search(query, limit=limit, alpha=alpha))
