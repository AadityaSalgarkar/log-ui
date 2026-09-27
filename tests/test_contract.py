"""The trackio store contract, checked against stores written by the installed trackio."""

import shutil
import sqlite3
from importlib.metadata import version

import pytest

from log_ui import contract
from tests.conftest import OTHER, PROJECT


def test_installed_trackio_is_in_supported_range():
    major, minor = (int(p) for p in version("trackio").split(".")[:2])
    assert (0, 38) <= (major, minor) < (0, 40), f"update contract.TRACKIO_VERSIONS for trackio {version('trackio')}"


def test_real_store_satisfies_schema(store_dir):
    with contract.open_project(store_dir, PROJECT) as reader:
        assert reader._tables == set(contract.SCHEMA)
        configs = {c.run_name: c for c in reader.configs()}
        assert set(configs) == {"run-a", "run-b"}
        assert configs["run-a"].config["seed"] == 0 and not any(k.startswith("_") for k in configs["run-a"].config)
        stats = {s.run_name: s for s in reader.run_stats()}
        assert stats["run-a"].last_step == 50 and stats["run-b"].last_step == 30
        assert reader.system_rows(None) == []


def test_reader_never_writes(store_dir):
    path = contract.project_path(store_dir, PROJECT)
    before = contract.signature(path)
    with contract.open_project(store_dir, PROJECT) as reader:
        reader.metric_rows(None)
        with pytest.raises(sqlite3.OperationalError, match="readonly"):
            reader._conn.execute("DELETE FROM metrics")
    assert contract.signature(path) == before


def test_missing_column_raises(store_dir, tmp_path):
    shutil.copy(contract.project_path(store_dir, OTHER), tmp_path / "old.db")
    with sqlite3.connect(tmp_path / "old.db") as conn:
        for (index,) in conn.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='metrics' AND sql IS NOT NULL").fetchall():
            conn.execute(f"DROP INDEX {index}")
        conn.execute("ALTER TABLE metrics DROP COLUMN step")
    with pytest.raises(contract.ContractError, match="'metrics' lacks columns \\['step'\\]"):
        with contract.open_project(tmp_path, "old"):
            pass


def test_absent_tables_read_as_empty(tmp_path):
    with sqlite3.connect(tmp_path / "bare.db") as conn:
        conn.execute("CREATE TABLE unrelated (x)")
    with contract.open_project(tmp_path, "bare") as reader:
        assert reader.configs() == [] and reader.run_stats() == [] and reader.metric_rows(None) == []


def test_not_sqlite_raises(tmp_path):
    (tmp_path / "junk.db").write_text("not a database")
    with pytest.raises(contract.ContractError):
        with contract.open_project(tmp_path, "junk"):
            pass


def test_project_names(tmp_path):
    for name in ("good", "registry-models", "has.dot", "a b"):
        sqlite3.connect(tmp_path / f"{name}.db").close()
    assert contract.list_projects(tmp_path) == ["good"]
    assert contract.list_projects(tmp_path / "missing") == []
    for bad in ("../x", "a/b", ".hidden", "", "registry-models"):
        with pytest.raises(KeyError):
            contract.project_path(tmp_path, bad)
    with pytest.raises(KeyError):
        with contract.open_project(tmp_path, "absent"):
            pass


def test_value_decoding():
    assert contract.parse_metrics('{"a": 1, "b": "NaN", "c": "text", "__step": 3, "d": true, "e": [1,2]}') == {
        "a": 1.0, "b": None,
    }
    assert contract.parse_metrics("not json") == {} and contract.parse_metrics("[1]") == {}
    assert contract.parse_config('{"lr": 1, "_Created": "2026-01-01T00:00:00"}') == ({"lr": 1}, "2026-01-01T00:00:00")
    assert contract.parse_config(None) == ({}, None) and contract.parse_config("oops") == ({}, None)
    assert abs(contract.parse_ts("2026-01-01T00:00:00+00:00") - 1767225600.0) < 1
    assert contract.parse_ts("2026-01-01T00:00:00") == contract.parse_ts("2026-01-01T00:00:00+00:00")  # naive is UTC
    assert contract.parse_ts("garbage") is None and contract.parse_ts(None) is None
