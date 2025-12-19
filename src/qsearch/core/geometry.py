from __future__ import annotations

import math

import numpy as np

from .constants import KAPPA_STAR


def _basin_to_simplex(basin: np.ndarray, *, eps: float) -> np.ndarray:
    x = np.asarray(basin, dtype=np.float32).reshape(-1)
    if x.size == 0:
        return np.zeros((0,), dtype=np.float32)

    # Basin signatures can contain negative components; map to a probability simplex
    # via squared magnitude.
    p = np.square(x)
    s = float(np.sum(p))
    if not math.isfinite(s) or s <= 0.0:
        # Avoid NaNs: fall back to a uniform distribution.
        return np.full((x.size,), 1.0 / float(x.size), dtype=np.float32)

    p = p / (s + eps)
    return np.clip(p, eps, 1.0)


def fisher_rao_distance(a: np.ndarray, b: np.ndarray, *, eps: float = 1e-8) -> float:
    """Fisher-Rao distance between two basin signatures.

    This is implemented on the probability simplex using the standard
    Fisher-Rao metric:

        d_FR(p, q) = 2 arccos( sum_i sqrt(p_i q_i) )

    where p and q are simplex-projected versions of the (possibly signed) basin
    vectors.
    """

    p = _basin_to_simplex(a, eps=eps)
    q = _basin_to_simplex(b, eps=eps)
    if p.size == 0 or q.size == 0:
        return float("inf")
    if p.shape != q.shape:
        raise ValueError("basin vectors must have the same shape")

    inner = float(np.sum(np.sqrt(p * q + eps)))
    inner = float(np.clip(inner, -1.0 + 1e-6, 1.0 - 1e-6))
    return float(2.0 * math.acos(inner))


def measure_phi_from_basin(basin: np.ndarray, *, eps: float = 1e-8) -> float:
    """Heuristic Φ (integration) measurement from a single basin signature.

    We compute the normalized entropy of the simplex-projected basin and map it
    into [0, 1]:

        Φ = 1 - H(p) / log(D)

    - Φ ≈ 0: energy spread uniformly across dimensions (low integration)
    - Φ ≈ 1: energy concentrated in fewer dimensions (high integration)
    """

    p = _basin_to_simplex(basin, eps=eps)
    if p.size == 0:
        return 0.0

    h = float(-np.sum(p * np.log(p + eps)))
    h_max = float(math.log(float(p.size)))
    if h_max <= 0.0:
        return 0.0

    phi = 1.0 - (h / h_max)
    return float(np.clip(phi, 0.0, 1.0))


def measure_kappa_from_basin(basin: np.ndarray) -> float:
    """κ (coupling) measurement from a single basin signature.

    In qsearch, basin vectors are typically L2-normalized by construction.
    We therefore treat κ as proportional to the basin magnitude:

        κ = κ* · ||b||₂

    where κ* is vendored in `qsearch.core.constants`.
    """

    x = np.asarray(basin, dtype=np.float32)
    n = float(np.linalg.norm(x))
    if not math.isfinite(n):
        return 0.0
    return float(max(0.0, KAPPA_STAR * n))
