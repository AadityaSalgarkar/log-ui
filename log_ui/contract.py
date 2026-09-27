"""The trackio store contract: the only module in log-ui that touches trackio's files.

log-ui never imports trackio and never writes to its store. It reads the sqlite database trackio keeps per
project, `<store_dir>/<project>.db`, over a read-only connection, and uses exactly the tables and columns
declared in `SCHEMA`. Every connection is checked against `SCHEMA` when it opens; a present table that lacks a
declared column raises `ContractError`, so a trackio schema change fails loudly instead of rendering wrong data.
An absent table reads as empty (older stores predate `system_metrics`).

Value encoding, as written by trackio:
  - timestamps are ISO-8601 text; naive values are UTC.
  - `metrics.metrics` / `system_metrics.metrics` are JSON objects. Values are numbers, the string "NaN", or
    non-scalars (media, tables, histograms). Only finite numbers are kept; "NaN" decodes to None; booleans and
    non-scalars are dropped. Keys starting with "__" are trackio-internal and hidden.
  - `configs.config` is a JSON object. Keys starting with "_" are trackio-internal (`_Created`, ...).
  - project files are named by trackio's canonical project name (`[A-Za-z0-9_-]+`); `registry-*` files are
    trackio artifact registries, not projects.

Verified against trackio `TRACKIO_VERSIONS`. Anything not declared here is outside the contract.
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TRACKIO_VERSIONS = ">=0.38,<0.40"

DB_SUFFIX = ".db"
RESERVED_PREFIXES = ("registry-",)
PROJECT_NAME = re.compile(r"[A-Za-z0-9_-]+")

SCHEMA: dict[str, tuple[str, ...]] = {
    "configs": ("id", "run_id", "run_name", "config", "created_at"),
    "metrics": ("id", "run_id", "run_name", "step", "timestamp", "metrics"),
    "system_metrics": ("id", "run_id", "run_name", "timestamp", "metrics"),
}

MetricRow = tuple[int, str, int, float, dict[str, float | None]]  # id, run_name, step, ts_epoch, metrics


class ContractError(RuntimeError):
    """The store does not match the declared contract (usually an unsupported trackio version)."""


@dataclass(frozen=True)
class ConfigRow:
    run_id: str
    run_name: str
    config: dict[str, Any]  # user keys only, "_"-prefixed internals removed
    created_at: str


@dataclass(frozen=True)
class RunStats:
    run_name: str
    first_ts: str | None
    last_ts: str | None
    last_step: int | None
    n_rows: int


# --- value decoding ---


def parse_ts(value: str | None) -> float | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def parse_metrics(raw: str | bytes) -> dict[str, float | None]:
    """Finite scalars by key; "NaN" (and non-finite numbers) as None; everything else dropped."""
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return {}
    if not isinstance(data, dict):
        return {}
    out: dict[str, float | None] = {}
    for k, v in data.items():
        if k.startswith("__"):
            continue
        if isinstance(v, str) and v.strip().lower() == "nan":
            out[k] = None
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            out[k] = float(v) if math.isfinite(v) else None
    return out


def parse_config(raw: str | bytes | None) -> tuple[dict[str, Any], str | None]:
    """(user config, trackio's `_Created` timestamp if present)."""
    try:
        data = json.loads(raw) if raw else {}
    except (ValueError, TypeError):
        return {}, None
    if not isinstance(data, dict):
        return {}, None
    created = data.get("_Created")
    user = {k: v for k, v in data.items() if not str(k).startswith("_")}
    return user, created if isinstance(created, str) else None


# --- files ---


def is_project_name(name: str) -> bool:
    return bool(PROJECT_NAME.fullmatch(name)) and not name.startswith(RESERVED_PREFIXES)


def project_path(store_dir: Path, project: str) -> Path:
    """Path of a project's database. Raises KeyError for names trackio would never write."""
    if not is_project_name(project):
        raise KeyError(project)
    return store_dir / f"{project}{DB_SUFFIX}"


def list_projects(store_dir: Path) -> list[str]:
    if not store_dir.is_dir():
        return []
    return sorted(p.stem for p in store_dir.glob(f"*{DB_SUFFIX}") if is_project_name(p.stem))


def signature(path: Path) -> tuple:
    """(mtime_ns, size) of the database and its WAL; changes whenever trackio commits."""
    parts = []
    for f in (path, path.with_name(path.name + "-wal")):
        try:
            st = f.stat()
            parts.append((st.st_mtime_ns, st.st_size))
        except FileNotFoundError:
            parts.append(None)
    return tuple(parts)


def last_modified(path: Path) -> float:
    """Epoch seconds of the last write. An empty WAL holds no writes (sqlite recreates it on open), so it is ignored."""
    db, wal = signature(path)
    mtimes = [s[0] for s in (db, wal if wal and wal[1] > 0 else None) if s is not None]
    return max(mtimes) / 1e9 if mtimes else 0.0


# --- reading ---


class ProjectReader:
    """Read-only access to one project database. Use via `open_project`."""

    def __init__(self, conn: sqlite3.Connection, tables: set[str]) -> None:
        self._conn = conn
        self._tables = tables

    def configs(self) -> list[ConfigRow]:
        if "configs" not in self._tables:
            return []
        out = []
        for row in self._conn.execute("SELECT run_id, run_name, config, created_at FROM configs ORDER BY id"):
            config, created = parse_config(row["config"])
            out.append(ConfigRow(row["run_id"], row["run_name"], config, row["created_at"] or created or ""))
        return out

    def run_stats(self) -> list[RunStats]:
        if "metrics" not in self._tables:
            return []
        sql = (
            "SELECT run_name, MIN(timestamp) AS first_ts, MAX(timestamp) AS last_ts, MAX(step) AS last_step, "
            "COUNT(*) AS n FROM metrics GROUP BY run_name"
        )
        return [
            RunStats(r["run_name"], r["first_ts"], r["last_ts"],
                     int(r["last_step"]) if r["last_step"] is not None else None, int(r["n"]))
            for r in self._conn.execute(sql)
        ]

    def latest_metrics(self, run_name: str, limit: int) -> list[dict[str, float | None]]:
        """Decoded metrics of a run's last `limit` rows, newest first."""
        if "metrics" not in self._tables:
            return []
        sql = "SELECT metrics FROM metrics WHERE run_name=? ORDER BY step DESC, id DESC LIMIT ?"
        return [parse_metrics(r["metrics"]) for r in self._conn.execute(sql, (run_name, limit))]

    def metric_rows(self, runs: list[str] | None, since_id: int = 0, max_rows: int | None = None) -> list[MetricRow]:
        return self._rows("metrics", "step", runs, since_id, max_rows)

    def system_rows(self, runs: list[str] | None, max_rows: int | None = None) -> list[MetricRow]:
        return self._rows("system_metrics", "0 AS step", runs, 0, max_rows)

    def _rows(self, table: str, step_col: str, runs, since_id, max_rows) -> list[MetricRow]:
        if table not in self._tables:
            return []
        sql = f"SELECT id, run_name, {step_col}, timestamp, metrics FROM {table} WHERE id > ?"
        params: list[Any] = [since_id]
        if runs:
            sql += f" AND run_name IN ({','.join('?' * len(runs))})"
            params.extend(runs)
        sql += " ORDER BY run_name, step, id"
        if max_rows:
            sql += " LIMIT ?"
            params.append(max_rows)
        return [
            (int(r["id"]), r["run_name"], int(r["step"]), parse_ts(r["timestamp"]) or 0.0, parse_metrics(r["metrics"]))
            for r in self._conn.execute(sql, params)
        ]


def check_schema(conn: sqlite3.Connection) -> set[str]:
    """Contract tables present in the database; raises ContractError if one lacks a declared column."""
    present = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    tables = set()
    for table, columns in SCHEMA.items():
        if table not in present:
            continue
        have = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
        missing = [c for c in columns if c not in have]
        if missing:
            raise ContractError(
                f"table {table!r} lacks columns {missing}; log-ui supports trackio {TRACKIO_VERSIONS}"
            )
        tables.add(table)
    return tables


@contextmanager
def open_project(store_dir: Path, project: str) -> Iterator[ProjectReader]:
    """Read-only reader for one project. KeyError if it does not exist, ContractError if its schema drifted."""
    path = project_path(store_dir, project)
    if not path.is_file():
        raise KeyError(project)
    conn = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True, timeout=30)
    try:
        conn.row_factory = sqlite3.Row
        try:
            tables = check_schema(conn)
        except sqlite3.DatabaseError as e:
            raise ContractError(f"{path.name} is not a readable sqlite database: {e}") from e
        yield ProjectReader(conn, tables)
    finally:
        conn.close()
