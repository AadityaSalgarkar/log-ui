# Changelog

All notable changes to log-ui are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/AadityaSalgarkar/log-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AadityaSalgarkar/log-ui/releases/tag/v0.1.0
