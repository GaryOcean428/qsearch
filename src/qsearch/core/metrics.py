from __future__ import annotations

import numpy as np


def basin_distance(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na == 0.0 or nb == 0.0:
        return float("inf")
    c = float(np.clip(np.dot(a, b) / (na * nb), -1.0, 1.0))
    return float(np.arccos(c))
