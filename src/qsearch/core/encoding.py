from __future__ import annotations

import hashlib
from typing import Iterable

import numpy as np

from .constants import BASIN_DIM


def _tokenize(text: str) -> list[str]:
    return [
        t
        for t in "".join(ch.lower() if ch.isalnum() else " " for ch in text).split()
        if t
    ]


def encode_text_to_basin(text: str, *, dim: int = BASIN_DIM) -> np.ndarray:
    tokens = _tokenize(text)
    if not tokens:
        return np.zeros((dim,), dtype=np.float32)

    vec = np.zeros((dim,), dtype=np.float32)
    for tok in tokens:
        h = hashlib.blake2b(tok.encode("utf-8"), digest_size=16).digest()
        i = int.from_bytes(h[:4], "little") % dim
        s = 1.0 if (h[4] & 1) == 0 else -1.0
        vec[i] += s

    n = float(np.linalg.norm(vec))
    return (vec / n) if n > 0 else vec


def batch_encode_texts(texts: Iterable[str], *, dim: int = BASIN_DIM) -> np.ndarray:
    rows = [encode_text_to_basin(t, dim=dim) for t in texts]
    if not rows:
        return np.zeros((0, dim), dtype=np.float32)
    return np.stack(rows, axis=0)
