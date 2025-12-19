from __future__ import annotations

from qsearch.index.models import Document
from qsearch.index.storage import DocumentStore


class SqlAlchemyPipeline:
    def __init__(self, db_url: str | None = None):
        self.store = DocumentStore(db_url=db_url)

    @classmethod
    def from_crawler(cls, crawler):
        db_url = crawler.settings.get("QSEARCH_DB_URL")
        return cls(db_url=db_url)

    def process_item(self, item, spider):
        doc = Document(
            doc_id=item["doc_id"],
            url=item["url"],
            title=item.get("title", ""),
            text=item.get("text", ""),
            basin=item["basin"],
            phi=float(item.get("phi", 0.0)),
        )
        with self.store.session() as s:
            existing = s.get(Document, doc.doc_id)
            if existing is None:
                s.add(doc)
            else:
                existing.url = doc.url
                existing.title = doc.title
                existing.text = doc.text
                existing.basin = doc.basin
                existing.phi = doc.phi
        return item
