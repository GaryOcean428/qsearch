import numpy as np

from qsearch.core.constants import KAPPA_STAR
from qsearch.core.encoding import encode_text_to_basin
from qsearch.core.geometry import (
    fisher_rao_distance,
    measure_kappa_from_basin,
    measure_phi_from_basin,
)


def test_fisher_rao_distance_is_symmetric_and_non_negative():
    a = encode_text_to_basin("quantum information geometry")
    b = encode_text_to_basin("quantum fisher information")

    dab = fisher_rao_distance(a, b)
    dba = fisher_rao_distance(b, a)

    assert dab >= 0.0
    assert dba >= 0.0
    assert np.isclose(dab, dba)


def test_measure_phi_from_basin_in_range():
    x = encode_text_to_basin("hello world")
    phi = measure_phi_from_basin(x)
    assert 0.0 <= phi <= 1.0


def test_measure_kappa_from_basin_scales_with_norm():
    x = np.zeros((64,), dtype=np.float32)
    x[0] = 1.0

    assert np.isclose(measure_kappa_from_basin(x), KAPPA_STAR)
