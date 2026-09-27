# log-ui

A self-hosted, wandb-style dashboard for experiments logged with [trackio](https://github.com/gradio-app/trackio).
One Python process serves a JSON API over trackio's sqlite store and a prebuilt React single-page app.
No Node at runtime, no accounts, no cloud.

```
pip install log-ui            # or: uv add log-ui
log-ui                        # serves ~/.cache/huggingface/trackio at http://127.0.0.1:8765
log-ui --dir /path/to/store --port 8765 --project my-project
```

## What you get

- Projects page, one card per trackio project.
- Workspace: select runs, chart every logged key grouped by prefix, smoothing, step or time x-axis,
  log scale, synced tooltips, detail modal with zoom, live polling while runs log.
- Runs table: status, steps, duration, config columns that differ between runs, sorting, filtering,
  multi-select.
- Run page: charts, flattened config, summary values, system metrics.
- Views: declarative panels (ladder, heatmap, table, line grid, stats) contributed by plugins, for
  project-specific comparisons that wandb would need custom panels for.
- Dark and light themes; every page state lives in the URL, so links are shareable.

## The trackio contract

log-ui is read-only and does not import trackio. Its only I/O with trackio is the on-disk sqlite store,
and all of that access lives in one module, `log_ui/contract.py`, which declares:

- the files it reads, `<store>/<project>.db` for canonical project names (`[A-Za-z0-9_-]+`, excluding
  trackio's `registry-*` databases);
- the tables and columns it reads (`configs`, `metrics`, `system_metrics`), and how their values are encoded;
- the trackio versions it is verified against (`TRACKIO_VERSIONS`, currently `>=0.38,<0.40`).

Connections are opened with `mode=ro`, and each one's schema is checked when it opens. If a store is missing
a declared column, log-ui returns a clear `unsupported trackio store` error and does not guess. To delete,
rename or move runs, use trackio (`trackio.Api().runs(project)`); log-ui picks up the change on its next read.

## API

All endpoints are read-only, return JSON under `/api`, and are documented interactively at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | version, store dir, supported trackio range |
| GET | `/api/projects` | projects with run counts |
| GET | `/api/projects/{p}/runs` | runs with status, last step, flattened config, summary |
| GET | `/api/projects/{p}/runs/{run}` | one run plus its keys and eval steps |
| GET | `/api/projects/{p}/keys` | metric keys with prefix and run counts |
| GET | `/api/projects/{p}/metrics?runs=a,b&keys=k1,k2&x=step&smoothing=0.5&max_points=1000` | series per run and key |
| GET | `/api/projects/{p}/system?runs=a,b` | system metrics (GPU, CPU) when logged |
| GET | `/api/projects/{p}/views` | view specs from plugins |
| GET | `/api/projects/{p}/views/{id}?runs=a,b&metric=m&point=last` | resolved panels |

## Views (plugins)

A view provider is a function `provide(project, runs) -> list[ViewSpec]`. Register it under the entry-point
group `log_ui.views` in your package, or pass `--views my_module:provide`. `runs` carries each run's
flattened config and summary, so a provider can derive categories from the config (species, datasets,
seeds) and map them to metric keys with templates like `val/{category}/{metric}`. Panel types: `ladder`
(one line per run across ordered categories), `heatmap` (runs x categories), `table`, `lines` (small
multiples over steps), `stats`. See `log_ui/views.py` for the dataclasses.

## Development

```
uv sync                       # backend + test deps
uv run pytest                 # backend tests against real trackio-written stores
cd web
npm ci
npm run dev                   # Vite dev server, proxies /api to http://127.0.0.1:8765
npm test && npm run typecheck
npm run build                 # writes ../log_ui/static (committed, shipped in the wheel)
```

## Roadmap

Media and table panels, artifacts, traces, alerts, sweep pages, run tags and notes, parameter importance,
report authoring, remote sync.

## License

MIT.
