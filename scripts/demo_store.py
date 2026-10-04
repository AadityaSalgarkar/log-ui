"""Write a synthetic trackio store to try log-ui without your own runs.

    uv run python scripts/demo_store.py /tmp/log-ui-demo
    uv run log-ui --dir /tmp/log-ui-demo --project lm-sweep

Runs are logged through trackio itself, so the store is exactly what trackio writes. Curves are deterministic
(seeded): a learning-rate sweep with warmup + cosine decay, noisy training losses, multi-level keys
(train/loss/total, train/loss/aux) and periodic evaluation metrics.
"""

from __future__ import annotations

import math
import os
import random
import sys
from pathlib import Path


def log_run(trackio, project: str, name: str, lr: float, layers: int, seed: int, steps: int) -> None:
    rng = random.Random(seed)
    trackio.init(project=project, name=name, config={"optim": {"lr": lr, "warmup": 200}, "model": {"layers": layers}, "seed": seed})
    floor = 2.1 - 0.08 * math.log2(layers) - 40 * min(lr, 1e-3)  # bigger model / better lr -> lower loss
    for step in range(1, steps + 1):
        warm = min(1.0, step / 200)
        sched = lr * warm * 0.5 * (1 + math.cos(math.pi * step / steps))
        total = floor + 2.4 * math.exp(-step / (350 / (lr / 3e-4) ** 0.5)) + rng.gauss(0, 0.06)
        payload = {
            "train/loss/total": total,
            "train/loss/aux": 0.15 * math.exp(-step / 900) + abs(rng.gauss(0, 0.01)),
            "train/lr": sched,
            "train/grad_norm": (3.0 * math.exp(-step / 300) + 0.4) * (lr / 3e-4) ** 0.3 + abs(rng.gauss(0, 0.15)),
            "train/tokens_per_s": 41_000 * (1 - 0.04 * math.log2(layers)) + rng.gauss(0, 900),
        }
        if step % 100 == 0:
            for split, gap in (("wiki", 0.04), ("code", 0.11), ("books", 0.07)):
                payload[f"val/{split}/loss"] = total - 0.03 + gap + rng.gauss(0, 0.01)
            ceiling = 0.62 + 0.25 * (2.3 - floor)  # better runs plateau higher
            payload["val/accuracy"] = min(0.99, max(0.0, ceiling * (1 - math.exp(-step / 450)) + rng.gauss(0, 0.004)))
        trackio.log(payload, step=step)
    trackio.finish()


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/log-ui-demo").expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)
    os.environ["TRACKIO_DIR"] = str(out)  # trackio reads this once, at import
    import trackio

    for name, lr, layers, seed in (
        ("lr3e-4-l12", 3e-4, 12, 0),
        ("lr1e-3-l12", 1e-3, 12, 1),
        ("lr1e-4-l12", 1e-4, 12, 2),
        ("lr3e-4-l24", 3e-4, 24, 3),
    ):
        log_run(trackio, "lm-sweep", name, lr, layers, seed, steps=2000)
    print(f"demo store written to {out}\nrun: uv run log-ui --dir {out} --project lm-sweep")


if __name__ == "__main__":
    main()
