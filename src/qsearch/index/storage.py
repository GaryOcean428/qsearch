from __future__ import annotations

import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from .models import Base


def _default_db_url() -> str:
    return os.environ.get("QSEARCH_DB_URL", "sqlite:///data/qsearch.db")


class DocumentStore:
    def __init__(self, db_url: str | None = None):
        self.db_url = db_url or _default_db_url()
        if self.db_url.startswith("sqlite:///"):
            db_path = self.db_url.removeprefix("sqlite:///")
            db_dir = os.path.dirname(db_path)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)
        self.engine = create_engine(self.db_url)
        Base.metadata.create_all(self.engine)

    @contextmanager
    def session(self) -> Session:
        s = Session(self.engine)
        try:
            yield s
            s.commit()
        except Exception:
            s.rollback()
            raise
        finally:
            s.close()
