# Changelog

All notable changes to log-ui are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-10-04

### Added

- Key plots replace pinned charts: charts at the top of the workspace and run page that overlay several metrics
  on one y axis (e.g. `train/loss` with `val/loss`). A metric can be in any number of key plots (A+B, A+C,
  A+D at once). Add metrics from any chart's pin menu or a plot's **+** picker; rename plots; remove metrics
  or whole plots. Existing pins become single-metric key plots automatically.
- Line styles for overlaid metrics while colour stays the run: 6 dash patterns, 4 sparse marker shapes and
  3 thicknesses, assigned automatically (30 distinct before repeating) and changeable per metric from the
  plot's legend.

### Changed

- Tooltips show every line's nearest logged value, marked with its step when not exactly under the cursor,
  so metrics logged at different steps (or downsampled to different points) all appear. Steps in tooltips
  are exact (`step 1,026`) instead of rounded.
- A metric in a key plot stays in its group below (pinned charts used to move out of their group).

## [0.2.0] - 2026-10-04

### Added

- Metric groups nest by key path: `loss/train/xent` sits in a "train" box inside the "loss" section, at any
  depth. Every group collapses on its own, the open/closed state is remembered per project, and chart titles
  drop the segments their group headers already show. Applies to the workspace and the run page.

## [0.1.0] - 2026-10-04

First release.

### Added

- Read-only, wandb-style dashboard for trackio stores: projects list, workspace with every logged key charted
  and grouped by prefix, runs table showing the config columns that differ, run page with config, summary and
  system metrics.
- Chart controls: EMA smoothing, step / relative / wall-clock x-axis, log y, a free-form point budget, pinned
  charts, and a full-screen view with a range brush.
- Per-chart settings: mean ± std or min–max bands over a trailing window of raw points (no look-ahead), and
  fixed x/y limits.
- View plugins (`log_ui.views` entry points or `--views module:function`) with ladder, heatmap, table, line-grid
  and stats panels.
- The trackio contract (`log_ui/contract.py`): the declared tables, columns and supported trackio versions
  (`>=0.38,<0.40`); read-only, schema-checked connections; stores on read-only filesystems read through a
  private snapshot that includes rows still in the WAL.
- Docker image on Alpine (`ghcr.io/aadityasalgarkar/log-ui`, amd64 and arm64) with a bundled demo store,
  non-root user, hardened `compose.yaml`, SBOM and signed build provenance.
- `scripts/demo_store.py` to generate a synthetic trackio store; project site with `llms.txt`.

[Unreleased]: https://github.com/AadityaSalgarkar/log-ui/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/AadityaSalgarkar/log-ui/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/AadityaSalgarkar/log-ui/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/AadityaSalgarkar/log-ui/releases/tag/v0.1.0
