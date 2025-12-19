from __future__ import annotations

from dataclasses import dataclass

from qsearch.core.encoding import encode_text_to_basin
from qsearch.index.basin_index import BasinIndex
from qsearch.index.models import Document
from qsearch.index.storage import DocumentStore


@dataclass(frozen=True)
class SearchResult:
    doc_id: str
    url: str
    title: str
    snippet: str
    distance: float


class SearchOrchestrator:
    def __init__(
        self, store: DocumentStore | None = None, *, db_url: str | None = None
    ):
        if store is not None:
            self.store = store
        else:
            self.store = DocumentStore(db_url=db_url)
        self.index = BasinIndex(self.store)

    def search(self, query: str, *, limit: int = 10) -> list[SearchResult]:
        q = encode_text_to_basin(query)
        hits = self.index.search(q, limit=limit)

        with self.store.session() as s:
            by_id = {
                d.doc_id: d
                for d in s.query(Document)
                .filter(Document.doc_id.in_([h.doc_id for h in hits]))
                .all()
            }

        out: list[SearchResult] = []
        for h in hits:
            d = by_id.get(h.doc_id)
            if d is None:
                continue
            out.append(
                SearchResult(
                    doc_id=d.doc_id,
                    url=d.url,
                    title=d.title,
                    snippet=(d.text or "")[:220],
                    distance=h.distance,
                )
            )
        return out
