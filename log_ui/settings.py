"""Server settings: dataclass defaults, overridden by LOG_UI_* environment variables, then CLI flags."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def default_store_dir() -> Path:
    for var in ("LOG_UI_DIR", "TRACKIO_DIR"):
        if os.environ.get(var):
            return Path(os.environ[var]).expanduser()
    return Path("~/.cache/huggingface/trackio").expanduser()


@dataclass
class Settings:
    store_dir: Path = field(default_factory=default_store_dir)
    host: str = "127.0.0.1"
    port: int = 8765
    stale_seconds: float = 120.0  # a run is "running" if it logged within this window
    default_max_points: int = 1000
    view_providers: list[str] = field(default_factory=list)  # "module:function" entries
    default_project: str | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        s = cls()
        if os.environ.get("LOG_UI_PORT"):
            s.port = int(os.environ["LOG_UI_PORT"])
        if os.environ.get("LOG_UI_HOST"):
            s.host = os.environ["LOG_UI_HOST"]
        if os.environ.get("LOG_UI_VIEWS"):
            s.view_providers = [v for v in os.environ["LOG_UI_VIEWS"].split(",") if v]
        if os.environ.get("LOG_UI_PROJECT"):
            s.default_project = os.environ["LOG_UI_PROJECT"]
        return s
