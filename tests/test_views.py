from log_ui.series import Series
from log_ui.store import RunInfo
from log_ui.views import (
    Category,
    MetricOption,
    PanelSpec,
    ViewSpec,
    collect_views,
    discover_providers,
    key_for,
    load_provider,
    pick_step,
    resolve_view,
    value_at,
)


def demo_provider(project: str, runs: list[RunInfo]) -> list[ViewSpec]:
    """A provider defined in this test module, loadable as tests.test_views:demo_provider."""
    cats = [
        Category("y", "Y species", "test", 2, {"tier": 2}),
        Category("x", "X species", "train", 0, {"tier": 0}),
    ]
    tmpl = {
        "bpb": "val/{category}/bpb",
        "excess": "val/{category}/excess",
        "kmer": {"sub": ["val/{category}/bpb", "val/{category}/excess"]},
    }
    return [
        ViewSpec(
            id="ladder",
            title="Ladder",
            metrics=[
                MetricOption("bpb", "bpb"),
                MetricOption("excess", "excess"),
                MetricOption("kmer", "kmer"),
            ],
            default_metric="bpb",
            best_key="val/x/bpb",
            panels=[
                PanelSpec("ladder", "L", cats, tmpl),
                PanelSpec("table", "T", cats, tmpl),
                PanelSpec("lines", "C", cats, tmpl),
                PanelSpec("stats", "S", keys=["gen/mean_gap"]),
            ],
        )
    ]


def _series():
    return {
        "run-a": {
            "val/x/bpb": Series([10, 20, 30], [1.95, 1.90, 1.92], [1, 2, 3]),
            "val/y/bpb": Series([10, 20, 30], [2.0, 1.99, 1.98], [1, 2, 3]),
            "val/x/excess": Series([10, 20, 30], [0.05, 0.02, 0.03], [1, 2, 3]),
            "gen/mean_gap": Series([10, 20, 30], [0.03, 0.03, 0.03], [1, 2, 3]),
            "train/loss": Series([1, 2, 31], [2.0, 1.9, 1.5], [1, 2, 3]),
        }
    }


def test_key_templates_and_values():
    assert key_for("val/{category}/{metric}", "x", "bpb") == "val/x/bpb"
    assert key_for({"sub": ["a/{category}", "b/{category}"]}, "x", None) == {"sub": ["a/x", "b/x"]}
    s = _series()["run-a"]
    assert value_at(s, "val/x/bpb", 20) == 1.90
    assert value_at(s, "val/x/bpb", 15) is None and value_at(s, "nope", 20) is None
    assert abs(value_at(s, {"sub": ["val/x/bpb", "val/x/excess"]}, 20) - 1.88) < 1e-9
    assert value_at(s, {"sub": ["val/x/bpb", "nope"]}, 20) is None


def test_pick_step():
    s = _series()["run-a"]
    assert pick_step(s, "last", "val/x/bpb", ["val/x/bpb", "val/y/bpb"]) == 30
    assert pick_step(s, "last", None) == 31  # any key, includes train/loss
    assert pick_step(s, "best", "val/x/bpb") == 20
    assert pick_step(s, "best", "missing", ["val/x/bpb"]) == 30  # falls back to last
    assert pick_step({}, "last", None) is None


def test_resolve_view_panels():
    view = demo_provider("p", [])[0]
    out = resolve_view(view, _series(), None, "best")
    assert out["metric"] == "bpb" and out["point"] == "best"
    ladder, table, lines, stats = out["panels"]
    assert [c["id"] for c in ladder["categories"]] == ["x", "y"]  # ordered by `order`
    assert ladder["series"]["run-a"] == [1.90, 1.99] and ladder["steps"]["run-a"] == 20
    assert table["keys"] == ["val/x/bpb", "val/y/bpb"]
    assert lines["keys"] == ["val/x/bpb", "val/y/bpb"] and lines["series"]["run-a"]["val/x/bpb"]["y"] == [
        1.95,
        1.90,
        1.92,
    ]
    assert stats["series"]["run-a"] == [0.03] and stats["categories"][0]["label"] == "gen/mean_gap"
    kmer = resolve_view(view, _series(), "kmer", "last")["panels"][0]
    assert abs(kmer["series"]["run-a"][0] - (1.92 - 0.03)) < 1e-9 and kmer["series"]["run-a"][1] is None
    unknown = resolve_view(view, _series(), "unknown-metric", "last")["panels"][0]
    assert unknown["series"]["run-a"] == [None, None]


def test_provider_loading_and_collection():
    p = load_provider("tests.test_views:demo_provider")
    assert p is demo_provider
    providers = discover_providers(["tests.test_views:demo_provider", "tests.test_views:demo_provider"])
    views = collect_views("p", [], providers)
    assert [v.id for v in views] == ["ladder"]  # duplicates by id collapsed
    assert views[0].to_dict()["panels"][0]["categories"][0]["meta"] == {"tier": 2}
    try:
        load_provider("nocolon")
        assert False
    except ValueError:
        pass
