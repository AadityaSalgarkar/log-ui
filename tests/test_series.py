import numpy as np
import pytest

from log_ui.series import (
    Series,
    build_series,
    downsample_indices,
    parse_bands,
    payloads,
    rolling_bands,
    smooth,
    to_payload,
)


def test_build_series_merges_steps_and_drops_none():
    rows = [
        (1, "r", 1, 100.0, {"a": 1.0, "b": 2.0}),
        (2, "r", 1, 101.0, {"a": 1.5}),  # same step: a overwritten, b kept
        (3, "r", 2, 102.0, {"a": None, "b": 3.0}),
        (4, "q", 1, 50.0, {"a": 9.0}),
    ]
    s = build_series(rows)
    assert s["r"]["a"].steps == [1] and s["r"]["a"].values == [1.5] and s["r"]["a"].ts == [101.0]
    assert s["r"]["b"].steps == [1, 2] and s["r"]["b"].values == [2.0, 3.0]
    assert s["q"]["a"].values == [9.0]


def test_smooth_matches_tensorboard_formula():
    v = [1.0, 2.0, 3.0, 4.0]
    out = smooth(v, 0.5)
    last, expected = 0.0, []
    for i, x in enumerate(v):
        last = last * 0.5 + 0.5 * x
        expected.append(last / (1 - 0.5 ** (i + 1)))
    assert np.allclose(out, expected)
    assert np.array_equal(smooth(v, 0.0), v) and smooth([], 0.5).size == 0
    assert abs(smooth([5.0] * 10, 0.9)[-1] - 5.0) < 1e-9  # constant stays constant


def test_downsample_keeps_extremes_and_bounds():
    rng = np.random.default_rng(0)
    y = rng.normal(size=10_000)
    idx = downsample_indices(y, 100)
    assert idx[0] == 0 and idx[-1] == len(y) - 1 and len(idx) <= 100
    assert np.all(np.diff(idx) > 0)
    assert int(np.argmin(y)) in idx and int(np.argmax(y)) in idx
    assert np.array_equal(downsample_indices(y, 0), np.arange(len(y)))
    assert np.array_equal(downsample_indices(y[:50], 100), np.arange(50))


def _brute_bands(y: np.ndarray, at: np.ndarray, w: int) -> dict[str, list[float]]:
    wins = [y[max(0, i - w + 1) : i + 1] for i in at]  # trailing: the w points ending at i
    return {
        "mean": [v.mean() for v in wins],
        "std": [v.std() for v in wins],
        "min": [v.min() for v in wins],
        "max": [v.max() for v in wins],
    }


def test_rolling_bands_match_direct_windows_including_edges():
    rng = np.random.default_rng(1)
    y = rng.normal(size=103)
    for w in (1, 2, 5, 10, 103, 500):  # even/odd, whole series, larger than the series
        at = np.array([0, 1, 7, 50, 101, 102])
        got, want = rolling_bands(y, at, w), _brute_bands(y, at, min(w, 103))
        for k in want:
            assert np.allclose(got[k], want[k]), (w, k)
    flat = rolling_bands(y, np.arange(103), 1)
    assert np.all(flat["std"] == 0) and np.array_equal(flat["min"], y)
    offset = rolling_bands(1000.0 + 1e-3 * np.array([1.0, -1.0] * 50), np.array([50]), 10)
    assert abs(offset["std"][0] - 1e-3) < 1e-9  # no cancellation on a large offset
    assert rolling_bands(y[:0], np.array([], dtype=int), 10)["mean"].size == 0


def test_rolling_bands_chunking_matches_unchunked():
    y = np.sin(np.arange(10_000) / 50.0)
    at = np.arange(0, 10_000, 1)  # more rows than one chunk
    got = rolling_bands(y, at, 21)
    want = _brute_bands(y, at[::997], 21)
    assert np.allclose(got["max"][::997], want["max"]) and np.allclose(got["mean"][::997], want["mean"])


def test_payload_band_is_a_trailing_window_of_raw_values():
    s = Series(steps=[1, 2, 3, 4, 5], values=[0.0, 2.0, 4.0, 6.0, 8.0], ts=[0.0, 1.0, 2.0, 3.0, 4.0])
    p = to_payload(s, "step", 0.9, 0, 0.0, band_window=3)  # smoothing affects y, not the band
    assert p["band"]["x"] == p["x"] == [1, 2, 3, 4, 5]
    assert p["band"]["mean"] == [0.0, 1.0, 2.0, 4.0, 6.0]  # start of run: only the points so far
    assert p["band"]["min"] == [0.0, 0.0, 0.0, 2.0, 4.0] and p["band"]["max"] == [
        0.0,
        2.0,
        4.0,
        6.0,
        8.0,
    ]  # no look-ahead
    assert p["band"]["window"] == 3
    assert (
        to_payload(s, "step", 0.0, 0, 0.0, band_window=50)["band"]["window"] == 5
    )  # capped at the run length
    assert "band" not in to_payload(s, "step", 0.0, 2, 0.0)
    out = payloads({"r": {"a": s, "b": s}}, None, "step", 0.0, 0, {}, bands={"b": 2})
    assert "band" not in out["r"]["a"] and out["r"]["b"]["band"]["window"] == 2


def test_parse_bands():
    assert parse_bands(["train/loss:10", "a:b:3"]) == {"train/loss": 10, "a:b": 3}
    assert parse_bands(None) == {}
    for bad in (["train/loss"], ["x:0"], ["x:-1"], ["x:abc"], [":5"], ["x:100001"]):
        with pytest.raises(ValueError):
            parse_bands(bad)


def test_payload_axes():
    s = Series(steps=[1, 2, 3], values=[1.0, 2.0, 3.0], ts=[1000.0, 1010.0, 1025.0])
    assert to_payload(s, "step", 0.0, 0, 990.0) == {"x": [1, 2, 3], "y": [1.0, 2.0, 3.0]}
    rel = to_payload(s, "relative_time", 0.0, 0, 990.0)
    assert rel["x"] == [10.0, 20.0, 35.0]
    assert to_payload(s, "wall_time", 0.0, 0, 0.0)["x"] == [1000.0, 1010.0, 1025.0]
    out = payloads({"r": {"a": s, "b": s}}, ["a", "zzz"], "step", 0.0, 0, {"r": 0.0})
    assert list(out["r"]) == ["a"]
