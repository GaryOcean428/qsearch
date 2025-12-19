from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, Float, Index, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    doc_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    url: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String, default="")
    text: Mapped[str] = mapped_column(String, default="")
    basin: Mapped[Any] = mapped_column(JSON, nullable=False)
    phi: Mapped[float] = mapped_column(Float, default=0.0)

    __table_args__ = (Index("idx_documents_url", "url"), Index("idx_documents_phi", "phi"))
