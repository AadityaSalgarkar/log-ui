import time

from log_ui.store import Store, flatten
from tests.conftest import OTHER, PROJECT


def test_flatten():
    assert flatten({"a": {"b": 1, "c": [1, {"d": 2}]}, "e": "x"}) == {
        "a.b": 1,
        "a.c[0]": 1,
        "a.c[1].d": 2,
        "e": "x",
    }
    assert flatten({}) == {}


def test_projects_and_runs(store_dir):
    store = Store(store_dir, stale_seconds=3600)
    projects = {p.name: p for p in store.projects()}
    assert set(projects) >= {PROJECT, OTHER}
    assert projects[PROJECT].n_runs == 2 and projects[OTHER].n_runs == 1
    runs = {r.name: r for r in store.runs(PROJECT)}
    assert set(runs) == {"run-a", "run-b"}
    a = runs["run-a"]
    assert a.last_step == 50 and a.n_rows >= 55
    assert a.status == "running"  # logged seconds ago, within stale window
    assert a.config == {"optim.lr": 1e-3, "model.n_layers": 4, "model.d_model": 128, "seed": 0}
    assert abs(a.summary["train/loss"] - (2.0 * 2.718281828 ** (-50 / 30) + 0.5)) < 1e-6
    assert "val/x/bpb" in a.summary and a.summary["gen/mean_gap"] == 0.03
    assert a.created_at and a.created_epoch > time.time() - 3600
    assert Store(store_dir, stale_seconds=0).run(PROJECT, "run-a").status == "finished"
    assert store.run(PROJECT, "nope") is None


def test_metric_rows_and_keys(store_dir):
    store = Store(store_dir)
    rows = store.metric_rows(PROJECT, ["run-a"])
    assert all(r[1] == "run-a" for r in rows)
    steps = [r[2] for r in rows]
    assert steps == sorted(steps) and steps[-1] == 50
    nan_rows = [r for r in rows if r[2] == 10 and "val/y/bpb" in r[4]]
    assert nan_rows and nan_rows[0][4]["val/y/bpb"] is None
    ids = [r[0] for r in rows]
    later = store.metric_rows(PROJECT, ["run-a"], since_id=ids[-3])
    assert [r[0] for r in later] == ids[-2:]
    keys = {k["key"]: k for k in store.keys(PROJECT)}
    assert keys["train/loss"]["n_runs"] == 2 and keys["train/loss"]["prefix"] == "train"
    assert "__step" not in keys


def test_cache_follows_trackio_writes_and_deletes(store_dir):
    import trackio

    store = Store(store_dir)
    store.runs(OTHER)
    cached = store._runs_cache[OTHER]
    store.runs(OTHER)
    assert store._runs_cache[OTHER] is cached  # unchanged file: no reload
    trackio.init(project=OTHER, name="extra", config={"a": 2})
    trackio.log({"train/loss": 1.0}, step=1)
    trackio.finish()
    assert {r.name for r in store.runs(OTHER)} == {"solo", "extra"}
    extra = next(r for r in trackio.Api().runs(OTHER) if r.name == "extra")
    assert extra.delete()  # deletion belongs to trackio; log-ui only observes it
    assert {r.name for r in store.runs(OTHER)} == {"solo"}


def test_status_follows_the_clock_not_the_cache(store_dir):
    store = Store(store_dir, stale_seconds=3600)
    assert store.run(PROJECT, "run-a").status == "running"
    store.stale_seconds = 0  # same cached rows, but "now" is past the window: the run must read as finished
    assert store.run(PROJECT, "run-a").status == "finished"
    assert store.runs(PROJECT)[0].last_logged_at is not None


def test_run_start_is_never_after_its_first_metric(store_dir):
    # Fast runs: trackio stamps buffered metrics before it writes the config row.
    for r in Store(store_dir).runs(PROJECT):
        assert r.last_logged_at is not None and r.last_logged_at >= r.created_epoch, r.name


def test_bad_project_names(store_dir):
    store = Store(store_dir)
    for bad in ("../x", "a/b", ".hidden", ""):
        assert not store.exists(bad)
