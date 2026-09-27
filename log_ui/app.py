"""FastAPI application: JSON API plus the prebuilt single-page app."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from log_ui import __version__
from log_ui.api import router
from log_ui.contract import ContractError
from log_ui.settings import Settings
from log_ui.store import Store
from log_ui.views import discover_providers

STATIC_DIR = Path(__file__).parent / "static"
HINT = (
    "log-ui API is running but the web bundle is missing.\n"
    "Build it with: cd web && npm ci && npm run build\n"
    "API docs: /docs\n"
)


def create_app(settings: Settings | None = None, static_dir: Path | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    static_dir = Path(static_dir or STATIC_DIR)
    app = FastAPI(title="log-ui", version=__version__)
    app.state.settings = settings
    app.state.store = Store(settings.store_dir, stale_seconds=settings.stale_seconds)
    app.state.view_providers = discover_providers(settings.view_providers)
    app.include_router(router)

    @app.exception_handler(ContractError)
    def contract_error(_request: Request, exc: ContractError):
        return JSONResponse({"detail": f"unsupported trackio store: {exc}"}, status_code=500)

    index = static_dir / "index.html"
    assets = static_dir / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            return PlainTextResponse("not found", status_code=404)
        candidate = static_dir / path
        if path and candidate.is_file() and candidate.resolve().is_relative_to(static_dir.resolve()):
            return FileResponse(candidate)
        if index.is_file():
            return FileResponse(index)
        return PlainTextResponse(HINT, status_code=200)

    return app
