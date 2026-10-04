"""Views: declarative panels resolved against run metrics (the generic replacement for wandb custom panels).

A view provider is a callable `provide(project: str, runs: list[RunInfo]) -> list[ViewSpec]` registered
under the entry-point group `log_ui.views` or given on the command line as `module:function`.

Key templates: a panel's `key_template` is either a string with `{category}` and `{metric}` placeholders,
or a dict `{metric_id: template}`; a template value may itself be `{"sub": [tmpl_a, tmpl_b]}` meaning the
value is `a - b`. Missing keys yield null.
"""

from __future__ import annotations

import importlib
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from importlib.metadata import entry_points
from typing import Any

from log_ui.series import Series
from log_ui.store import RunInfo

PANEL_TYPES = ("ladder", "heatmap", "table", "lines", "stats")
POINTS = ("last", "best")


@dataclass
class Category:
    id: str
    label: str
    group: str = ""
    order: int = 0
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class MetricOption:
    id: str
    label: str
    help: str = ""


@dataclass
class PanelSpec:
    type: str
    title: str
    categories: list[Category] = field(default_factory=list)
    key_template: Any = None  # str | dict[str, str | {"sub": [str, str]}]
    keys: list[str] = field(default_factory=list)  # for stats/lines without categories
    description: str = ""


@dataclass
class ViewSpec:
    id: str
    title: str
    description: str = ""
    panels: list[PanelSpec] = field(default_factory=list)
    metrics: list[MetricOption] = field(default_factory=list)
    default_metric: str | None = None
    best_key: str | None = None  # step with the minimum of this key is the "best" point
    points: list[str] = field(default_factory=lambda: list(POINTS))

    def to_dict(self) -> dict:
        return asdict(self)


Provider = Callable[[str, list[RunInfo]], list[ViewSpec]]


def load_provider(spec: str) -> Provider:
    module, _, func = spec.partition(":")
    if not module or not func:
        raise ValueError(f"view provider must be 'module:function', got {spec!r}")
    return getattr(importlib.import_module(module), func)


def discover_providers(extra: list[str] | None = None) -> list[Provider]:
    providers: list[Provider] = []
    for ep in entry_points(group="log_ui.views"):
        try:
            providers.append(ep.load())
        except Exception as e:  # noqa: BLE001 - a broken plugin must not take the dashboard down
            print(f"[log-ui] failed to load view provider {ep.name}: {e}")
    for spec in extra or []:
        providers.append(load_provider(spec))
    return providers


def collect_views(project: str, runs: list[RunInfo], providers: list[Provider]) -> list[ViewSpec]:
    out: list[ViewSpec] = []
    seen: set[str] = set()
    for p in providers:
        try:
            specs = p(project, runs) or []
        except Exception as e:  # noqa: BLE001 - one failing provider must not hide the others' views
            print(f"[log-ui] view provider {p} failed for {project}: {e}")
            continue
        for s in specs:
            if s.id in seen:
                continue
            seen.add(s.id)
            out.append(s)
    return out


# --- resolution ---


def _template_for(panel: PanelSpec, metric_id: str | None) -> Any:
    t = panel.key_template
    if isinstance(t, dict) and "sub" not in t:
        if metric_id is None or metric_id not in t:
            return None
        return t[metric_id]
    return t


def key_for(template: Any, category_id: str, metric_id: str | None) -> Any:
    """Concrete key (str) or {"sub": [key_a, key_b]} for one category."""
    if template is None:
        return None
    if isinstance(template, dict) and "sub" in template:
        a, b = template["sub"]
        return {"sub": [key_for(a, category_id, metric_id), key_for(b, category_id, metric_id)]}
    return str(template).replace("{category}", category_id).replace("{metric}", metric_id or "")


def value_at(series: dict[str, Series], key: Any, step: int | None) -> float | None:
    if key is None or step is None:
        return None
    if isinstance(key, dict) and "sub" in key:
        a = value_at(series, key["sub"][0], step)
        b = value_at(series, key["sub"][1], step)
        return None if a is None or b is None else a - b
    s = series.get(key)
    if s is None:
        return None
    try:
        i = s.steps.index(step)
    except ValueError:
        return None
    return s.values[i]


def pick_step(
    series: dict[str, Series], point: str, best_key: str | None, consider: list[Any] | None = None
) -> int | None:
    """'last': the last step at which any considered key was logged; 'best': argmin of best_key."""
    if point == "best" and best_key and best_key in series and len(series[best_key]):
        s = series[best_key]
        i = min(range(len(s)), key=lambda j: s.values[j])
        return s.steps[i]
    keys = _flatten_keys(consider) if consider else list(series)
    steps = [series[k].steps[-1] for k in keys if k in series and len(series[k])]
    return max(steps) if steps else None


def _flatten_keys(keys: list[Any]) -> list[str]:
    out: list[str] = []
    for k in keys:
        if isinstance(k, dict) and "sub" in k:
            out.extend(_flatten_keys(k["sub"]))
        elif isinstance(k, str):
            out.append(k)
    return out


def resolve_panel(
    view: ViewSpec,
    panel: PanelSpec,
    runs_series: dict[str, dict[str, Series]],
    metric_id: str | None,
    point: str,
) -> dict:
    template = _template_for(panel, metric_id)
    cats = sorted(panel.categories, key=lambda c: (c.order, c.label))
    if panel.type == "lines":
        keys = [key_for(template, c.id, metric_id) for c in cats] if cats else list(panel.keys)
        keys = [k for k in keys if isinstance(k, str) and any(k in per for per in runs_series.values())]
        series_out = {
            run: {k: {"x": per_key[k].steps, "y": per_key[k].values} for k in keys if k in per_key}
            for run, per_key in runs_series.items()
        }
        return {
            "type": "lines",
            "title": panel.title,
            "keys": keys,
            "categories": [asdict(c) for c in cats],
            "series": series_out,
        }
    keys = [key_for(template, c.id, metric_id) for c in cats] if cats else list(panel.keys)
    labels = [c.label for c in cats] if cats else list(panel.keys)
    series_out: dict[str, list[float | None]] = {}
    steps_out: dict[str, int | None] = {}
    for run, per_key in runs_series.items():
        step = pick_step(per_key, point, view.best_key, keys)
        steps_out[run] = step
        series_out[run] = [value_at(per_key, k, step) for k in keys]
    return {
        "type": panel.type,
        "title": panel.title,
        "description": panel.description,
        "categories": [asdict(c) for c in cats]
        if cats
        else [{"id": k, "label": k, "group": "", "order": i, "meta": {}} for i, k in enumerate(labels)],
        "keys": keys,
        "series": series_out,
        "steps": steps_out,
        "metric": metric_id,
        "point": point,
    }


def resolve_view(
    view: ViewSpec, runs_series: dict[str, dict[str, Series]], metric_id: str | None, point: str
) -> dict:
    metric_id = metric_id or view.default_metric or (view.metrics[0].id if view.metrics else None)
    point = point if point in POINTS else "last"
    return {
        "spec": view.to_dict(),
        "metric": metric_id,
        "point": point,
        "panels": [resolve_panel(view, p, runs_series, metric_id, point) for p in view.panels],
    }
