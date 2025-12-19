from qsearch.core.encoding import encode_text_to_basin
from qsearch.core.metrics import basin_distance


def test_basin_distance_smoke():
    a = encode_text_to_basin("quantum information geometry")
    b = encode_text_to_basin("quantum fisher information")
    c = encode_text_to_basin("cats and dogs")

    dab = basin_distance(a, b)
    dac = basin_distance(a, c)
    assert dab <= dac
