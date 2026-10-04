# syntax=docker/dockerfile:1
#
# log-ui on a minimal Alpine image: a Python virtualenv and the app, nothing else (no compilers, no Node).
#
#   docker build -t log-ui .
#   docker run --rm -p 127.0.0.1:8765:8765 log-ui                                         # bundled demo
#   docker run --rm -p 127.0.0.1:8765:8765 -v ~/.cache/huggingface/trackio:/data:ro log-ui  # your runs, read-only
#
# See compose.yaml for the hardened setup (read-only root filesystem, no capabilities).

ARG PYTHON=3.12
ARG UV=0.8.0

FROM ghcr.io/astral-sh/uv:${UV} AS uv

# --- demo store: written by trackio itself. Debian, because trackio's dependencies have no musl wheels.
# Only the resulting .db files leave this stage.
FROM python:${PYTHON}-slim AS demo
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /src
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project --group dev
COPY scripts/demo_store.py scripts/
RUN .venv/bin/python scripts/demo_store.py /demo

# --- the app's virtualenv, built on the same Alpine base as the runtime.
FROM python:${PYTHON}-alpine AS build
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1 UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock README.md LICENSE ./
RUN uv sync --locked --no-dev --no-install-project
COPY log_ui ./log_ui
RUN uv sync --locked --no-dev --no-editable \
 && find .venv -depth -type d \( -name tests -o -name testing \) -path "*/site-packages/*" -exec rm -rf {} + \
 && find .venv -name "*.pyi" -delete

# --- runtime
FROM python:${PYTHON}-alpine
LABEL org.opencontainers.image.title="log-ui" \
      org.opencontainers.image.description="A local, read-only, wandb-style dashboard for trackio stores" \
      org.opencontainers.image.source="https://github.com/AadityaSalgarkar/log-ui" \
      org.opencontainers.image.licenses="MIT"
RUN adduser -D -H -u 10001 logui
COPY --from=build /app/.venv /app/.venv
COPY --from=demo /demo/*.db /demo/
COPY docker/entrypoint.sh /usr/local/bin/log-ui-entrypoint
ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    LOG_UI_HOST=0.0.0.0 \
    LOG_UI_PORT=8765
USER 10001
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8765/api/health >/dev/null || exit 1
ENTRYPOINT ["log-ui-entrypoint"]
