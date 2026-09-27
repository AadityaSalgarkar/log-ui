import json
import os
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from log_ui.app import create_app
from log_ui.settings import Settings
from tests.conftest import OTHER, PROJECT

FIXTURES = Path(__file__).resolve().parents[1] / "web" / "fixtures"


@pytest.fixture(scope="module")
def client(store_dir):
    settings = Settings(store_dir=store_dir, stale_seconds=3600, view_providers=["tests.test_views:demo_provider"])
    return TestClient(create_app(settings, static_dir=store_dir / "no-static"))


def test_health_and_projects(client):
    h = client.get("/api/health").json()
    assert h["ok"] and h["version"] and h["trackio"]
    names = [p["name"] for p in client.get("/api/projects").json()]
    assert PROJECT in names and OTHER in names
    assert client.get("/api/projects/nope/runs").status_code == 404
    assert client.get("/api/projects/../etc/runs").status_code in (404, 422)


def test_runs_and_run_detail(client):
    runs = client.get(f"/api/projects/{PROJECT}/runs").json()
    assert {r["name"] for r in runs} == {"run-a", "run-b"}
    a = next(r for r in runs if r["name"] == "run-a")
    assert a["config"]["model.n_layers"] == 4 and a["last_step"] == 50 and a["status"] == "running"
    d = client.get(f"/api/projects/{PROJECT}/runs/run-a").json()
    assert d["eval_steps"] == [10, 20, 30, 40, 50] and "train/loss" in d["keys"] and d["system_keys"] == []
    assert client.get(f"/api/projects/{PROJECT}/runs/nope").status_code == 404


def test_eval_steps_skip_ungrouped_and_train_keys(client):
    import trackio

    trackio.init(project="evalsteps", name="r", config={})
    for step in range(1, 11):
        payload = {"epoch": step // 5, "train/loss/total": 1.0, "train/loss/aux": 0.1}
        if step % 5 == 0:
            payload["val/loss"] = 0.5
        trackio.log(payload, step=step)
    trackio.finish()
    d = client.get("/api/projects/evalsteps/runs/r").json()
    assert d["eval_steps"] == [5, 10]
    assert {"train/loss/total", "train/loss/aux", "epoch"} <= set(d["keys"])
    keys = {k["key"]: k for k in client.get("/api/projects/evalsteps/keys").json()}
    assert keys["train/loss/aux"]["prefix"] == "train" and keys["epoch"]["prefix"] == ""


def test_keys_and_metrics(client):
    keys = client.get(f"/api/projects/{PROJECT}/keys").json()
    assert {"key": "train/loss", "prefix": "train", "n_runs": 2} in keys
    m = client.get(f"/api/projects/{PROJECT}/metrics", params={"runs": "run-a,run-b,ghost", "keys": "train/loss,val/x/bpb", "max_points": 10}).json()
    assert set(m["series"]) == {"run-a", "run-b"}
    assert set(m["series"]["run-a"]) == {"train/loss", "val/x/bpb"}
    assert len(m["series"]["run-a"]["train/loss"]["x"]) <= 10 and m["series"]["run-a"]["train/loss"]["x"][-1] == 50
    assert m["series"]["run-a"]["val/x/bpb"]["x"] == [10, 20, 30, 40, 50]
    sm = client.get(f"/api/projects/{PROJECT}/metrics", params={"runs": "run-a", "keys": "train/loss", "smoothing": 0.9, "max_points": 0}).json()
    raw = client.get(f"/api/projects/{PROJECT}/metrics", params={"runs": "run-a", "keys": "train/loss", "max_points": 0}).json()
    assert len(sm["series"]["run-a"]["train/loss"]["y"]) == 50
    assert sm["series"]["run-a"]["train/loss"]["y"][-1] > raw["series"]["run-a"]["train/loss"]["y"][-1]  # lagging EMA of a decaying loss
    rel = client.get(f"/api/projects/{PROJECT}/metrics", params={"runs": "run-a", "keys": "train/loss", "x": "relative_time"}).json()
    xs = rel["series"]["run-a"]["train/loss"]["x"]
    assert xs == sorted(xs) and xs[0] >= -1
    assert client.get(f"/api/projects/{PROJECT}/metrics", params={"x": "bogus"}).status_code == 422
    nan_series = client.get(f"/api/projects/{PROJECT}/metrics", params={"runs": "run-a", "keys": "val/y/bpb"}).json()
    assert nan_series["series"]["run-a"]["val/y/bpb"]["x"] == [20, 30, 40, 50]  # NaN at step 10 dropped
    inc = client.get(f"/api/projects/{PROJECT}/metrics", params={"runs": "run-a", "since_id": m["last_id"]}).json()
    assert inc["series"] == {} or all(not v for v in inc["series"].values())


def test_metrics_bands(client):
    params = {"runs": "run-a", "keys": "train/loss,train/lr", "max_points": 0, "bands": "train/loss:5"}
    m = client.get(f"/api/projects/{PROJECT}/metrics", params=params).json()["series"]["run-a"]
    assert "band" not in m["train/lr"]
    loss, band = m["train/loss"], m["train/loss"]["band"]
    assert band["window"] == 5 and band["x"] == loss["x"] and len(band["x"]) == 50  # independent of max_points
    assert all(lo <= mu <= hi for lo, mu, hi in zip(band["min"], band["mean"], band["max"]))
    assert band["std"][0] == 0 and all(s > 0 for s in band["std"][1:])  # trailing: step 1 has nothing before it
    few = client.get(f"/api/projects/{PROJECT}/metrics", params={**params, "max_points": 10}).json()
    assert few["series"]["run-a"]["train/loss"]["band"]["window"] == 5  # still 5 raw points, not 50 / 10
    bad = client.get(f"/api/projects/{PROJECT}/metrics", params={**params, "bands": "train/loss"})
    assert bad.status_code == 422 and "key:window" in bad.json()["detail"]


def test_system_empty(client):
    s = client.get(f"/api/projects/{PROJECT}/system", params={"runs": "run-a"}).json()
    assert s["series"] == {}


def test_views_endpoints(client):
    views = client.get(f"/api/projects/{PROJECT}/views").json()
    assert [v["id"] for v in views] == ["ladder"]
    v = client.get(f"/api/projects/{PROJECT}/views/ladder", params={"runs": "run-a", "metric": "bpb", "point": "last"}).json()
    ladder = v["panels"][0]
    assert list(ladder["series"]) == ["run-a"] and ladder["steps"]["run-a"] == 50
    assert ladder["series"]["run-a"][0] == pytest.approx(1.9 + 0.1 * 2.718281828 ** (-50 / 20), rel=1e-6)
    assert client.get(f"/api/projects/{PROJECT}/views/nope").status_code == 404


def test_api_is_read_only(client):
    assert client.request("DELETE", f"/api/projects/{PROJECT}/runs", json={"runs": ["run-a"]}).status_code == 405
    assert "run-a" in {r["name"] for r in client.get(f"/api/projects/{PROJECT}/runs").json()}


def test_schema_drift_is_reported(tmp_path):
    db = tmp_path / "drifted.db"
    with sqlite3.connect(db) as conn:
        conn.execute("CREATE TABLE metrics (id INTEGER PRIMARY KEY, run_name TEXT, metrics TEXT)")
    c = TestClient(create_app(Settings(store_dir=tmp_path), static_dir=tmp_path / "none"))
    r = c.get("/api/projects/drifted/runs")
    assert r.status_code == 500 and "unsupported trackio store" in r.json()["detail"]
    assert c.get("/api/projects").json() == []  # listed projects skip unreadable stores


def test_write_fixtures(client):
    """Dump real API responses for the frontend tests when LOG_UI_WRITE_FIXTURES=1."""
    if not os.environ.get("LOG_UI_WRITE_FIXTURES"):
        pytest.skip("set LOG_UI_WRITE_FIXTURES=1 to refresh web/fixtures")
    FIXTURES.mkdir(parents=True, exist_ok=True)
    dumps = {
        "projects.json": client.get("/api/projects").json(),
        "runs.json": client.get(f"/api/projects/{PROJECT}/runs").json(),
        "keys.json": client.get(f"/api/projects/{PROJECT}/keys").json(),
        "metrics.json": client.get(f"/api/projects/{PROJECT}/metrics", params={"runs": "run-a,run-b", "max_points": 50}).json(),
        "views.json": client.get(f"/api/projects/{PROJECT}/views").json(),
        "view_ladder.json": client.get(f"/api/projects/{PROJECT}/views/ladder", params={"runs": "run-a,run-b"}).json(),
        "run_detail.json": client.get(f"/api/projects/{PROJECT}/runs/run-a").json(),
    }
    for name, data in dumps.items():
        (FIXTURES / name).write_text(json.dumps(data, indent=1))
