import numpy as np

from log_ui.series import Series, build_series, downsample_indices, payloads, smooth, to_payload, window_bands


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


def test_window_bands_match_numpy_per_window():
    rng = np.random.default_rng(1)
    y = rng.normal(size=103)
    x = np.arange(103, dtype=np.float64) * 10
    b = window_bands(x, y, 10)
    edges = np.linspace(0, 103, 11).astype(int)
    windows = [y[a:z] for a, z in zip(edges[:-1], edges[1:])]
    assert b["window"] == 11 and len(b["x"]) == 10
    assert np.allclose(b["mean"], [w.mean() for w in windows])
    assert np.allclose(b["std"], [w.std() for w in windows])
    assert np.allclose(b["min"], [w.min() for w in windows]) and np.allclose(b["max"], [w.max() for w in windows])
    assert all(x[a] <= bx <= x[z - 1] for bx, a, z in zip(b["x"], edges[:-1], edges[1:]))
    one = window_bands(x[:5], y[:5], 0)  # max_points=0: one point per window, zero spread
    assert one["window"] == 1 and np.allclose(one["std"], 0) and np.allclose(one["min"], y[:5])
    assert window_bands(x[:0], y[:0], 10)["x"] == []


def test_payload_band_uses_raw_values():
    s = Series(steps=[1, 2, 3, 4], values=[0.0, 2.0, 4.0, 6.0], ts=[0.0, 1.0, 2.0, 3.0])
    p = to_payload(s, "step", 0.9, 2, 0.0, band=True)
    assert p["band"]["x"] == [1, 3] and p["band"]["mean"] == [1.0, 5.0] and p["band"]["std"] == [1.0, 1.0]
    assert p["band"]["min"] == [0.0, 4.0] and p["band"]["max"] == [2.0, 6.0] and p["band"]["window"] == 2
    assert "band" not in to_payload(s, "step", 0.0, 2, 0.0)
    out = payloads({"r": {"a": s, "b": s}}, None, "step", 0.0, 2, {}, band_keys=["b"])
    assert "band" not in out["r"]["a"] and "band" in out["r"]["b"]


def test_payload_axes():
    s = Series(steps=[1, 2, 3], values=[1.0, 2.0, 3.0], ts=[1000.0, 1010.0, 1025.0])
    assert to_payload(s, "step", 0.0, 0, 990.0) == {"x": [1, 2, 3], "y": [1.0, 2.0, 3.0]}
    rel = to_payload(s, "relative_time", 0.0, 0, 990.0)
    assert rel["x"] == [10.0, 20.0, 35.0]
    assert to_payload(s, "wall_time", 0.0, 0, 0.0)["x"] == [1000.0, 1010.0, 1025.0]
    out = payloads({"r": {"a": s, "b": s}}, ["a", "zzz"], "step", 0.0, 0, {"r": 0.0})
    assert list(out["r"]) == ["a"]
