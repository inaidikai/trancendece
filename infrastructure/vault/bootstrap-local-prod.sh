#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE:-"$PROJECT_ROOT/infrastructure/docker-compose.yml"}
INIT_FILE=${VAULT_INIT_FILE:-"$SCRIPT_DIR/.local-init.json"}
POLICY_FILE=${VAULT_POLICY_FILE:-"$SCRIPT_DIR/policies/app-read.hcl"}
POLICY_NAME=${VAULT_POLICY_NAME:-quillow-app-read}
RUNTIME_DIR=${VAULT_RUNTIME_DIR:-"$PROJECT_ROOT/infrastructure/runtime"}
TOKEN_FILE=${VAULT_TOKEN_OUT_FILE:-"$RUNTIME_DIR/app-token"}
VAULT_ADDR_LOCAL=${VAULT_ADDR_LOCAL:-http://127.0.0.1:8200}
VAULT_ADDR=${VAULT_ADDR:-http://localhost:8200}
VAULT_KV_PATH=${VAULT_KV_PATH:-kv/data/app}
APP_TOKEN_TTL=${APP_TOKEN_TTL:-720h}
VAULT_AUTO_RECOVER=${VAULT_AUTO_RECOVER:-false}
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-$(basename "$(dirname "$COMPOSE_FILE")")}

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

json_field() {
  local key="$1"
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(String(j['$key'] ?? ''));});"
}

status_field() {
  local key="$1"
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(String(j['$key']));});"
}

wait_for_vault() {
  local retries=60
  local i
  local status_json
  for ((i = 1; i <= retries; i += 1)); do
    status_json=$(compose exec -T vault sh -lc "VAULT_ADDR=$VAULT_ADDR_LOCAL vault status -format=json 2>/dev/null || true")
    if [[ "$status_json" == *"\"initialized\""* ]]; then
      return 0
    fi
    sleep 1
  done
  echo "Vault did not become reachable in time" >&2
  exit 1
}

reset_local_vault_data() {
  local volume_ids
  echo "Resetting local Vault data volume because init material is missing..."
  compose rm -sf vault >/dev/null 2>&1 || true
  volume_ids=$(docker volume ls -q \
    --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
    --filter "label=com.docker.compose.volume=vault-data")
  if [[ -n "$volume_ids" ]]; then
    # shellcheck disable=SC2086
    docker volume rm $volume_ids >/dev/null
  fi
  compose up -d vault
  wait_for_vault
}

echo "Starting Vault service in server mode..."
compose up -d vault
wait_for_vault

status_json=$(compose exec -T vault sh -lc "VAULT_ADDR=$VAULT_ADDR_LOCAL vault status -format=json" 2>/dev/null || true)
initialized=$(printf '%s' "$status_json" | status_field initialized 2>/dev/null || echo "false")

if [[ "$initialized" != "true" ]]; then
  echo "Vault not initialized. Initializing now..."
  init_json=$(compose exec -T vault sh -lc "VAULT_ADDR=$VAULT_ADDR_LOCAL vault operator init -key-shares=3 -key-threshold=3 -format=json")
  printf '%s\n' "$init_json" > "$INIT_FILE"
  chmod 600 "$INIT_FILE"
  echo "Saved local init material at $INIT_FILE"
else
  if [[ ! -f "$INIT_FILE" ]]; then
    if [[ "$VAULT_AUTO_RECOVER" == "true" ]]; then
      reset_local_vault_data
      status_json=$(compose exec -T vault sh -lc "VAULT_ADDR=$VAULT_ADDR_LOCAL vault status -format=json" 2>/dev/null || true)
      initialized=$(printf '%s' "$status_json" | status_field initialized 2>/dev/null || echo "false")
      if [[ "$initialized" != "true" ]]; then
        echo "Vault reset complete. Initializing now..."
        init_json=$(compose exec -T vault sh -lc "VAULT_ADDR=$VAULT_ADDR_LOCAL vault operator init -key-shares=3 -key-threshold=3 -format=json")
        printf '%s\n' "$init_json" > "$INIT_FILE"
        chmod 600 "$INIT_FILE"
        echo "Saved local init material at $INIT_FILE"
      fi
    else
      echo "Vault is already initialized but $INIT_FILE is missing." >&2
      echo "Restore this file or set VAULT_INIT_FILE to your existing init material." >&2
      echo "For local reset, run with VAULT_AUTO_RECOVER=true." >&2
      exit 1
    fi
  fi
fi

mapfile -t UNSEAL_KEYS < <(node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));(d.unseal_keys_b64||[]).slice(0,3).forEach(k=>console.log(k));" "$INIT_FILE")
ROOT_TOKEN=$(node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(d.root_token||'');" "$INIT_FILE")

if [[ ${#UNSEAL_KEYS[@]} -lt 3 || -z "$ROOT_TOKEN" ]]; then
  echo "Invalid init material in $INIT_FILE" >&2
  exit 1
fi

sealed=$(printf '%s' "$status_json" | status_field sealed 2>/dev/null || echo "true")
if [[ "$sealed" == "true" ]]; then
  echo "Unsealing Vault..."
  for key in "${UNSEAL_KEYS[@]}"; do
    compose exec -T vault sh -lc "VAULT_ADDR=$VAULT_ADDR_LOCAL vault operator unseal '$key' >/dev/null"
  done
fi

echo "Applying policy: $POLICY_NAME"
compose exec -T vault sh -lc "VAULT_ADDR=$VAULT_ADDR_LOCAL VAULT_TOKEN='$ROOT_TOKEN' vault policy write '$POLICY_NAME' -" < "$POLICY_FILE"

echo "Creating app token from policy..."
token_json=$(compose exec -T vault sh -lc "VAULT_ADDR=$VAULT_ADDR_LOCAL VAULT_TOKEN='$ROOT_TOKEN' vault token create -orphan -policy='$POLICY_NAME' -ttl='$APP_TOKEN_TTL' -format=json")
app_token=$(printf '%s' "$token_json" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.auth.client_token||'');});")

if [[ -z "$app_token" ]]; then
  echo "Failed to create app token" >&2
  exit 1
fi

mkdir -p "$RUNTIME_DIR"
printf '%s\n' "$app_token" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
echo "Wrote app token to $TOKEN_FILE"

echo "Seeding Vault kv at $VAULT_KV_PATH ..."
VAULT_ADDR="$VAULT_ADDR" VAULT_TOKEN="$ROOT_TOKEN" VAULT_KV_PATH="$VAULT_KV_PATH" "$SCRIPT_DIR/seed.sh"

echo "Vault bootstrap complete."
