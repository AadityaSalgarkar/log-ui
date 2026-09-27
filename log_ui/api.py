"""JSON API under /api. Read-only: log-ui never modifies the trackio store."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query, Request

from log_ui import __version__
from log_ui.contract import TRACKIO_VERSIONS
from log_ui.series import X_MODES, build_series, payloads
from log_ui.views import collect_views, resolve_view

router = APIRouter(prefix="/api")


def _csv(value: str | None) -> list[str] | None:
    if value is None or value == "":
        return None
    return [v for v in value.split(",") if v]


def _store(request: Request):
    return request.app.state.store


def _settings(request: Request):
    return request.app.state.settings


def _project(request: Request, project: str):
    store = _store(request)
    if not store.exists(project):
        raise HTTPException(404, f"project {project!r} not found")
    return store


@router.get("/health")
def health(request: Request):
    s = _settings(request)
    return {"ok": True, "version": __version__, "store_dir": str(s.store_dir), "trackio": TRACKIO_VERSIONS,
            "default_project": s.default_project}


@router.get("/projects")
def projects(request: Request):
    return [asdict(p) for p in _store(request).projects()]


@router.get("/projects/{project}/runs")
def runs(request: Request, project: str):
    store = _project(request, project)
    return [asdict(r) for r in store.runs(project)]


@router.get("/projects/{project}/runs/{run}")
def run_detail(request: Request, project: str, run: str):
    store = _project(request, project)
    info = store.run(project, run)
    if info is None:
        raise HTTPException(404, f"run {run!r} not found")
    series = build_series(store.metric_rows(project, [run])).get(run, {})
    # Eval steps: where a prefixed, non-train key was logged. Ungrouped keys (epoch, lr) are logged every step.
    eval_steps = sorted({s for k, ser in series.items() if "/" in k and not k.startswith("train/") for s in ser.steps})
    sys_rows = store.system_rows(project, [run], max_rows=5000)
    sys_keys = sorted({k for *_, m in sys_rows for k in m})
    return {**asdict(info), "keys": sorted(series), "eval_steps": eval_steps, "system_keys": sys_keys}


@router.get("/projects/{project}/keys")
def keys(request: Request, project: str):
    return _project(request, project).keys(project)


@router.get("/projects/{project}/metrics")
def metrics(
    request: Request,
    project: str,
    runs: str | None = None,
    keys: str | None = None,
    x: str = Query("step"),
    smoothing: float = Query(0.0, ge=0.0, lt=1.0),
    max_points: int | None = Query(None, ge=0),
    since_id: int = Query(0, ge=0),
    band_keys: str | None = Query(None, description="keys that also get per-window mean/std/min/max"),
):
    store = _project(request, project)
    if x not in X_MODES:
        raise HTTPException(422, f"x must be one of {X_MODES}")
    run_names = _csv(runs)
    key_list = _csv(keys)
    mp = _settings(request).default_max_points if max_points is None else max_points
    rows = store.metric_rows(project, run_names, since_id=since_id)
    created = {r.name: r.created_epoch for r in store.runs(project)}
    series = build_series(rows)
    last_id = max((r[0] for r in rows), default=since_id)
    out = payloads(series, key_list, x, smoothing, mp, created, _csv(band_keys))
    return {"x": x, "smoothing": smoothing, "last_id": last_id, "series": out}


@router.get("/projects/{project}/system")
def system(
    request: Request,
    project: str,
    runs: str | None = None,
    max_points: int | None = Query(None, ge=0),
    band_keys: str | None = None,
):
    store = _project(request, project)
    rows = store.system_rows(project, _csv(runs))
    created = {r.name: r.created_epoch for r in store.runs(project)}
    mp = _settings(request).default_max_points if max_points is None else max_points
    series = build_series(rows)
    for per_key in series.values():  # system rows have no step; index them by order
        for s in per_key.values():
            s.steps = list(range(len(s.values)))
    return {"x": "relative_time", "series": payloads(series, None, "relative_time", 0.0, mp, created, _csv(band_keys))}


@router.get("/projects/{project}/views")
def views(request: Request, project: str):
    store = _project(request, project)
    specs = collect_views(project, store.runs(project), request.app.state.view_providers)
    return [s.to_dict() for s in specs]


@router.get("/projects/{project}/views/{view_id}")
def view(request: Request, project: str, view_id: str, runs: str | None = None, metric: str | None = None, point: str = "last"):
    store = _project(request, project)
    all_runs = store.runs(project)
    specs = collect_views(project, all_runs, request.app.state.view_providers)
    spec = next((s for s in specs if s.id == view_id), None)
    if spec is None:
        raise HTTPException(404, f"view {view_id!r} not found")
    selected = _csv(runs)
    names = [r.name for r in all_runs if selected is None or r.name in selected]
    series = build_series(store.metric_rows(project, names)) if names else {}
    return resolve_view(spec, series, metric, point)
