#!/usr/bin/env bash

set -euo pipefail

COMMAND=${1:-dev}
shift || true

EXTRA_ARGS=("$@")

ENV_FLAG=()
if [[ -f "./.env" ]]; then
  ENV_FLAG=(--env-file ./.env)
fi

exec npx --yes trigger.dev@4.0.6 "${COMMAND}" "${ENV_FLAG[@]}" "${EXTRA_ARGS[@]}"
