#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-infrastructure/docker-compose.yml}
TAIL=${TAIL:-200}
FOLLOW=${FOLLOW:-false}

compose_cmd=(docker compose -f "$COMPOSE_FILE" logs --tail "$TAIL")
if [[ "$FOLLOW" == "true" ]]; then
  compose_cmd+=(--follow)
fi

# Keep only actionable lines:
# - HTTP status 4xx/5xx
# - explicit error/fatal/fail/exception keywords
# - socket upstream failures
matches=$(
  "${compose_cmd[@]}" \
    | grep -Ei --line-buffered \
      '" [45][0-9]{2} |error|fatal|failed|exception|denied|connect\(\) failed|could not be resolved|invalid_client' \
    | sed -E \
      -e 's/^[[:space:]]*//' \
      -e 's/\|/\t| /' || true
)

if [[ -z "$matches" ]]; then
  echo "No error/4xx/5xx lines in the selected log window."
else
  printf '%s\n' "$matches"
fi
