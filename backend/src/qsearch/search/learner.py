"""
Continuous learning service for qsearch.

Provides:
- Background crawling of discovered URLs
- Content summarization
- Basin knowledge accumulation
- Search pattern learning
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import httpx
from bs4 import BeautifulSoup

from qsearch.core.encoding import encode_text_to_basin
from qsearch.core.geometry import measure_phi_from_basin
from qsearch.index.models import Document
from qsearch.index.storage import DocumentStore

_log = logging.getLogger("qsearch.learner")


@dataclass
class LearningStats:
    urls_queued: int = 0
    urls_crawled: int = 0
    urls_failed: int = 0
    documents_added: int = 0
    last_crawl_time: Optional[datetime] = None


@dataclass
class CrawlTask:
    url: str
    priority: int = 0
    source: str = "hybrid_search"
    created_at: datetime = field(default_factory=datetime.utcnow)


class ContinuousLearner:
    """
    Background service that continuously learns from discovered content.

    Features:
    - Queue URLs discovered during hybrid search for background crawling
    - Extract and index content with basin geometry
    - Track learning statistics
    - Summarize content for quick retrieval
    """

    def __init__(
        self,
        store: Optional[DocumentStore] = None,
        db_url: Optional[str] = None,
        max_queue_size: int = 1000,
        crawl_delay: float = 1.0,
    ):
        self.store = store or DocumentStore(db_url=db_url)
        self.max_queue_size = max_queue_size
        self.crawl_delay = crawl_delay

        self._queue: list[CrawlTask] = []
        self._seen_urls: set[str] = set()
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self.stats = LearningStats()

    def queue_url(
        self, url: str, priority: int = 0, source: str = "hybrid_search"
    ) -> bool:
        """Add URL to crawl queue."""
        url_hash = hashlib.sha256(url.encode()).hexdigest()[:16]

        if url_hash in self._seen_urls:
            return False

        if len(self._queue) >= self.max_queue_size:
            # Remove lowest priority item
            self._queue.sort(key=lambda x: x.priority, reverse=True)
            self._queue.pop()

        self._queue.append(CrawlTask(url=url, priority=priority, source=source))
        self._seen_urls.add(url_hash)
        self.stats.urls_queued += 1

        _log.debug("Queued URL: %s (priority=%d, source=%s)", url, priority, source)
        return True

    def queue_from_hybrid_results(self, results: list) -> int:
        """Queue URLs from hybrid search results for learning."""
        count = 0
        for i, result in enumerate(results):
            url = getattr(result, "url", None) or result.get("url")
            if url and self.queue_url(
                url, priority=len(results) - i, source="hybrid_search"
            ):
                count += 1
        return count

    async def start(self):
        """Start background learning loop."""
        if self._running:
            return

        self._running = True
        self._task = asyncio.create_task(self._learning_loop())
        _log.info("Continuous learner started")

    async def stop(self):
        """Stop background learning."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        _log.info("Continuous learner stopped")

    async def _learning_loop(self):
        """Main learning loop."""
        while self._running:
            if not self._queue:
                await asyncio.sleep(self.crawl_delay)
                continue

            # Get highest priority task
            self._queue.sort(key=lambda x: x.priority, reverse=True)
            task = self._queue.pop(0)

            try:
                await self._crawl_and_index(task.url)
                self.stats.urls_crawled += 1
                self.stats.last_crawl_time = datetime.utcnow()
            except Exception as e:
                _log.error("Failed to crawl %s: %s", task.url, e)
                self.stats.urls_failed += 1

            await asyncio.sleep(self.crawl_delay)

    async def _crawl_and_index(self, url: str):
        """Fetch URL content and add to index."""
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                response = await client.get(
                    url,
                    headers={"User-Agent": "qsearch-learner/1.0"},
                )
                response.raise_for_status()

                # Parse HTML
                soup = BeautifulSoup(response.content, "lxml")
                for tag in soup(["script", "style", "nav", "footer", "header"]):
                    tag.decompose()

                title = (soup.title.string or "").strip() if soup.title else ""
                text = soup.get_text(separator=" ", strip=True)[:5000]

                if len(text) < 100:
                    _log.debug("Skipping %s - content too short", url)
                    return

                # Compute basin and phi
                basin = encode_text_to_basin(text)
                phi = measure_phi_from_basin(basin)

                # Generate doc_id
                doc_id = hashlib.sha256(url.encode()).hexdigest()[:16]

                # Check if already exists
                with self.store.session() as session:
                    existing = (
                        session.query(Document)
                        .filter(Document.doc_id == doc_id)
                        .first()
                    )
                    if existing:
                        _log.debug("Document already exists: %s", url)
                        return

                    # Add to database
                    doc = Document(
                        doc_id=doc_id,
                        url=url,
                        title=title,
                        text=text,
                        basin=basin.tolist(),
                        phi=phi,
                    )
                    session.add(doc)
                    session.commit()

                self.stats.documents_added += 1
                _log.info("Indexed: %s (phi=%.4f)", url, phi)

        except Exception as e:
            raise RuntimeError(f"Crawl failed: {e}") from e

    def get_stats(self) -> dict:
        """Get learning statistics."""
        return {
            "urls_queued": self.stats.urls_queued,
            "urls_crawled": self.stats.urls_crawled,
            "urls_failed": self.stats.urls_failed,
            "documents_added": self.stats.documents_added,
            "queue_size": len(self._queue),
            "last_crawl_time": (
                self.stats.last_crawl_time.isoformat()
                if self.stats.last_crawl_time
                else None
            ),
            "running": self._running,
        }


# Singleton instance
_learner: Optional[ContinuousLearner] = None


def get_learner(db_url: Optional[str] = None) -> ContinuousLearner:
    """Get or create singleton learner instance."""
    global _learner
    if _learner is None:
        _learner = ContinuousLearner(db_url=db_url)
    return _learner
