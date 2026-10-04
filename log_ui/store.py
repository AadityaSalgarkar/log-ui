"""Projects and runs assembled from the trackio store, cached per database revision.

All file access goes through `log_ui.contract`; this module holds no SQL and never writes.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

from log_ui import contract
from log_ui.contract import MetricRow, parse_ts

SUMMARY_ROWS = 400  # rows scanned from the end of a run to find each key's last value


@dataclass
class ProjectInfo:
    name: str
    db_path: str
    n_runs: int
    updated_at: float  # epoch seconds of the last db modification


@dataclass
class RunInfo:
    name: str
    run_id: str | None
    created_at: str
    created_epoch: float
    last_step: int | None
    last_logged_at: float | None
    status: str  # running | finished
    config: dict[str, Any] = field(default_factory=dict)  # flattened dot keys
    summary: dict[str, float | None] = field(default_factory=dict)  # last scalar per key
    n_rows: int = 0


def flatten(obj: Any, prefix: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {}
    if isinstance(obj, dict):
        items = ((f"{prefix}.{k}" if prefix else str(k), v) for k, v in obj.items())
    elif isinstance(obj, list):
        items = ((f"{prefix}[{i}]", v) for i, v in enumerate(obj))
    else:
        return {prefix: obj}
    for key, v in items:
        if isinstance(v, (dict, list)):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


class Store:
    def __init__(self, store_dir: Path | str, stale_seconds: float = 120.0) -> None:
        self.dir = Path(store_dir).expanduser()
        self.stale_seconds = stale_seconds
        self._runs_cache: dict[str, tuple[tuple, list[RunInfo]]] = {}

    def exists(self, project: str) -> bool:
        try:
            return contract.project_path(self.dir, project).is_file()
        except KeyError:
            return False

    # --- projects ---

    def projects(self) -> list[ProjectInfo]:
        out = []
        for name in contract.list_projects(self.dir):
            try:
                n_runs = len(self.runs(name))
            except (contract.ContractError, KeyError) as e:
                print(f"[log-ui] skipping project {name!r}: {e}")
                continue
            path = contract.project_path(self.dir, name)
            out.append(
                ProjectInfo(
                    name=name, db_path=str(path), n_runs=n_runs, updated_at=contract.last_modified(path)
                )
            )
        out.sort(key=lambda x: x.updated_at, reverse=True)
        return out

    # --- runs ---

    def runs(self, project: str) -> list[RunInfo]:
        sig = contract.signature(contract.project_path(self.dir, project))
        cached = self._runs_cache.get(project)
        if cached and cached[0] == sig:
            runs = cached[1]
        else:
            runs = self._load_runs(project)
            self._runs_cache[project] = (sig, runs)
        # Status depends on the clock, not just the file: a run that stops logging leaves the db untouched.
        now = time.time()
        return [replace(r, status=self._status(r.last_logged_at, now)) for r in runs]

    def _status(self, last_logged_at: float | None, now: float) -> str:
        recent = last_logged_at is not None and now - last_logged_at < self.stale_seconds
        return "running" if recent else "finished"

    def run(self, project: str, name: str) -> RunInfo | None:
        return next((r for r in self.runs(project) if r.name == name), None)

    def _load_runs(self, project: str) -> list[RunInfo]:
        with contract.open_project(self.dir, project) as reader:
            configs = {c.run_name: c for c in reader.configs()}
            stats = {s.run_name: s for s in reader.run_stats()}
            out: list[RunInfo] = []
            for name in dict.fromkeys([*configs, *stats]):
                c, s = configs.get(name), stats.get(name)
                created_at = (c.created_at if c else "") or (s.first_ts if s else "") or ""
                last_logged = parse_ts(s.last_ts) if s else None
                summary: dict[str, float | None] = {}
                for metrics in reader.latest_metrics(name, SUMMARY_ROWS):  # newest first, first seen wins
                    for k, v in metrics.items():
                        summary.setdefault(k, v)
                out.append(
                    RunInfo(
                        name=name,
                        run_id=c.run_id if c else None,
                        created_at=created_at,
                        created_epoch=parse_ts(created_at) or 0.0,
                        last_step=s.last_step if s else None,
                        last_logged_at=last_logged,
                        status="finished",  # set per read in runs()
                        config=flatten(c.config) if c else {},
                        summary=summary,
                        n_rows=s.n_rows if s else 0,
                    )
                )
        out.sort(key=lambda r: r.created_epoch, reverse=True)
        return out

    # --- metrics ---

    def metric_rows(
        self, project: str, runs: list[str] | None = None, since_id: int = 0, max_rows: int | None = None
    ) -> list[MetricRow]:
        with contract.open_project(self.dir, project) as reader:
            return reader.metric_rows(runs, since_id, max_rows)

    def system_rows(
        self, project: str, runs: list[str] | None = None, max_rows: int | None = None
    ) -> list[MetricRow]:
        with contract.open_project(self.dir, project) as reader:
            return reader.system_rows(runs, max_rows)

    def keys(self, project: str) -> list[dict[str, Any]]:
        counts: dict[str, set[str]] = {}
        for _, run, _, _, metrics in self.metric_rows(project):
            for k in metrics:
                counts.setdefault(k, set()).add(run)
        return [
            {"key": k, "prefix": k.split("/", 1)[0] if "/" in k else "", "n_runs": len(v)}
            for k, v in sorted(counts.items())
        ]
