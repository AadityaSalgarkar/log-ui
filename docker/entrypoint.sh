#!/bin/sh
# Serve the trackio store mounted at /data, or the bundled demo when nothing is mounted.
# Extra arguments go to log-ui (e.g. --project NAME). LOG_UI_DIR overrides the choice.
set -eu

if [ -z "${LOG_UI_DIR:-}" ]; then
  if ls /data/*.db >/dev/null 2>&1; then
    export LOG_UI_DIR=/data
  else
    export LOG_UI_DIR=/demo
    export LOG_UI_PROJECT="${LOG_UI_PROJECT:-lm-sweep}"
    echo "log-ui: no trackio store mounted at /data, serving the bundled demo." >&2
    echo "log-ui: mount yours read-only with: -v ~/.cache/huggingface/trackio:/data:ro" >&2
  fi
fi

exec log-ui "$@"
