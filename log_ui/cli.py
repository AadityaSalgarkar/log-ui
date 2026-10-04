"""`log-ui`: serve the dashboard for a trackio store directory."""

from __future__ import annotations

import argparse
import webbrowser
from pathlib import Path

from log_ui import __version__
from log_ui.settings import Settings


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="log-ui", description="wandb-style dashboard for trackio stores")
    p.add_argument(
        "--dir", help="trackio store directory (default: $TRACKIO_DIR or ~/.cache/huggingface/trackio)"
    )
    p.add_argument("--host", default=None)
    p.add_argument("--port", type=int, default=None)
    p.add_argument("--project", default=None, help="project to open by default")
    p.add_argument(
        "--views", action="append", default=[], help="extra view provider as module:function (repeatable)"
    )
    p.add_argument(
        "--stale-seconds", type=float, default=None, help="runs idle longer than this are 'finished'"
    )
    p.add_argument("--open", action="store_true", help="open a browser")
    p.add_argument("--version", action="version", version=__version__)
    return p


def settings_from_args(args: argparse.Namespace) -> Settings:
    s = Settings.from_env()
    if args.dir:
        s.store_dir = Path(args.dir).expanduser()
    if args.host:
        s.host = args.host
    if args.port:
        s.port = args.port
    if args.project:
        s.default_project = args.project
    if args.views:
        s.view_providers = list(s.view_providers) + list(args.views)
    if args.stale_seconds is not None:
        s.stale_seconds = args.stale_seconds
    return s


def main(argv: list[str] | None = None) -> None:
    import uvicorn

    from log_ui.app import create_app

    args = build_parser().parse_args(argv)
    settings = settings_from_args(args)
    app = create_app(settings)
    url = f"http://{settings.host}:{settings.port}/"
    print(f"log-ui {__version__} serving {settings.store_dir} at {url}")
    if args.open:
        webbrowser.open(url)
    uvicorn.run(app, host=settings.host, port=settings.port, log_level="warning")


if __name__ == "__main__":
    main()
