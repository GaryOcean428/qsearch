from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from qsearch.core.metrics import basin_distance
from qsearch.index.models import Document
from qsearch.index.storage import DocumentStore


@dataclass(frozen=True)
class SearchHit:
    doc_id: str
    distance: float


class BasinIndex:
    def __init__(self, store: DocumentStore):
        self.store = store

    def search(self, query_basin: np.ndarray, *, limit: int = 10) -> list[SearchHit]:
        with self.store.session() as s:
            docs = s.query(Document).all()

        hits: list[SearchHit] = []
        for d in docs:
            b = np.asarray(d.basin, dtype=np.float32)
            hits.append(
                SearchHit(doc_id=d.doc_id, distance=basin_distance(query_basin, b))
            )

        hits.sort(key=lambda h: h.distance)
        return hits[:limit]
