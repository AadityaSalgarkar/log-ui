"""Real trackio stores written into a temp dir. No mocks.

trackio reads TRACKIO_DIR once at import, so the env var is set here at conftest import time, before any test
module imports trackio, and the whole suite shares one store directory.
"""

import math
import os
import tempfile
from pathlib import Path

import pytest

_STORE = Path(tempfile.mkdtemp(prefix="log_ui_store_"))
os.environ["TRACKIO_DIR"] = str(_STORE)
os.environ["LOG_UI_DIR"] = str(_STORE)

import trackio  # noqa: E402  (after the env var)

PROJECT = "demo"
OTHER = "other"


def _log_run(project: str, name: str, config: dict, steps: int, loss0: float, eval_every: int, with_nan: bool = False):
    trackio.init(project=project, name=name, config=config)
    try:
        for step in range(1, steps + 1):
            loss = loss0 * math.exp(-step / 30) + 0.5
            trackio.log({"train/loss": loss, "train/lr": 1e-3 * step / steps}, step=step)
            if step % eval_every == 0:
                payload = {"val/x/bpb": 1.9 + 0.1 * math.exp(-step / 20), "val/y/bpb": 2.0 - 0.01 * step / eval_every,
                           "val/x/excess": 0.05 * math.exp(-step / 25), "val/y/excess": 0.08 - 0.001 * step / eval_every,
                           "gen/mean_gap": 0.03}
                if with_nan and step == eval_every:
                    payload["val/y/bpb"] = float("nan")
                trackio.log(payload, step=step)
    finally:
        trackio.finish()


@pytest.fixture(scope="session")
def store_dir() -> Path:
    _log_run(PROJECT, "run-a", {"optim": {"lr": 1e-3}, "model": {"n_layers": 4, "d_model": 128}, "seed": 0}, 50, 2.0, 10, with_nan=True)
    _log_run(PROJECT, "run-b", {"optim": {"lr": 3e-4}, "model": {"n_layers": 8, "d_model": 128}, "seed": 1}, 30, 1.5, 10)
    _log_run(OTHER, "solo", {"a": 1}, 5, 1.0, 5)
    return _STORE
