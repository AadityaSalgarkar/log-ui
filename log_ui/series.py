"""Turn metric rows into per-run, per-key series; smoothing and downsampling for the charts."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from log_ui.store import MetricRow

X_MODES = ("step", "relative_time", "wall_time")


@dataclass
class Series:
    steps: list[int] = field(default_factory=list)
    values: list[float] = field(default_factory=list)
    ts: list[float] = field(default_factory=list)  # epoch seconds

    def __len__(self) -> int:
        return len(self.steps)


def build_series(rows: list[MetricRow]) -> dict[str, dict[str, Series]]:
    """{run: {key: Series}} with rows sharing a step merged (later id wins) and None values dropped."""
    merged: dict[str, dict[int, tuple[float, dict[str, float | None]]]] = {}
    for _id, run, step, ts, metrics in rows:  # rows arrive ordered by run, step, id
        per_run = merged.setdefault(run, {})
        if step in per_run:
            per_run[step][1].update(metrics)
            per_run[step] = (max(per_run[step][0], ts), per_run[step][1])
        else:
            per_run[step] = (ts, dict(metrics))
    out: dict[str, dict[str, Series]] = {}
    for run, per_step in merged.items():
        series: dict[str, Series] = {}
        for step in sorted(per_step):
            ts, metrics = per_step[step]
            for k, v in metrics.items():
                if v is None:
                    continue
                s = series.setdefault(k, Series())
                s.steps.append(step)
                s.values.append(v)
                s.ts.append(ts)
        out[run] = series
    return out


def smooth(values: list[float] | np.ndarray, weight: float) -> np.ndarray:
    """TensorBoard/wandb exponential moving average with debiasing.

    s_t = w * s_{t-1} + (1 - w) * v_t, reported as s_t / (1 - w^t). weight=0 returns the input.
    """
    v = np.asarray(values, dtype=np.float64)
    if not 0.0 < weight < 1.0 or v.size == 0:
        return v.copy()
    out = np.empty_like(v)
    last = 0.0
    for i, x in enumerate(v):
        last = last * weight + (1.0 - weight) * x
        out[i] = last / (1.0 - weight ** (i + 1))
    return out


def downsample_indices(y: np.ndarray, max_points: int) -> np.ndarray:
    """Indices keeping endpoints plus the min and max of each bucket; result has at most max_points entries."""
    n = y.size
    if max_points <= 0 or n <= max_points:
        return np.arange(n)
    max_points = max(max_points, 4)
    buckets = max(1, max_points // 2 - 1)
    edges = np.linspace(0, n, buckets + 1).astype(int)
    keep = {0, n - 1}
    for a, b in zip(edges[:-1], edges[1:]):
        if b <= a:
            continue
        seg = y[a:b]
        keep.add(a + int(np.argmin(seg)))
        keep.add(a + int(np.argmax(seg)))
    idx = np.array(sorted(keep), dtype=int)
    return idx[:max_points]


def x_values(s: Series, mode: str, created_epoch: float) -> np.ndarray:
    if mode == "relative_time":
        return np.asarray(s.ts, dtype=np.float64) - created_epoch
    if mode == "wall_time":
        return np.asarray(s.ts, dtype=np.float64)
    return np.asarray(s.steps, dtype=np.float64)


def to_payload(s: Series, mode: str, smoothing: float, max_points: int, created_epoch: float) -> dict:
    x = x_values(s, mode, created_epoch)
    y = smooth(s.values, smoothing)
    idx = downsample_indices(y, max_points)
    x_out = x[idx]
    if mode == "step":
        x_list = [int(v) for v in x_out]
    else:
        x_list = [round(float(v), 3) for v in x_out]
    return {"x": x_list, "y": [round(float(v), 6) for v in y[idx]]}


def payloads(
    series: dict[str, dict[str, Series]],
    keys: list[str] | None,
    mode: str,
    smoothing: float,
    max_points: int,
    created: dict[str, float],
) -> dict[str, dict[str, dict]]:
    out: dict[str, dict[str, dict]] = {}
    for run, per_key in series.items():
        selected = per_key if keys is None else {k: per_key[k] for k in keys if k in per_key}
        out[run] = {k: to_payload(s, mode, smoothing, max_points, created.get(run, 0.0)) for k, s in selected.items()}
    return out
