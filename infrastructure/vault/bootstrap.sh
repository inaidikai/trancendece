#!/usr/bin/env sh
set -eu

# One-shot bootstrap container:
# - waits for Vault (TLS)
# - seeds secrets (seed.sh) using root token from VAULT_DEV_ROOT_TOKEN
# - creates a read-only app token and writes it to /vault/shared/app-token

VAULT_ADDR="${VAULT_ADDR:-https://vault:8200}"
VAULT_TLS_SKIP_VERIFY="${VAULT_TLS_SKIP_VERIFY:-true}"
VAULT_DEV_ROOT_TOKEN="${VAULT_DEV_ROOT_TOKEN:-my-secret-token}"
VAULT_APP_TOKEN_FILE="${VAULT_APP_TOKEN_FILE:-/vault/shared/app-token}"

KV_READ_PATH="${VAULT_KV_READ_PATH:-secret/data/app}"
POLICY_NAME="${VAULT_APP_POLICY_NAME:-app-read}"
APP_TTL="${VAULT_APP_TOKEN_TTL:-24h}"

log() { printf '%s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

curl_cmd() {
  if [ "$VAULT_TLS_SKIP_VERIFY" = "true" ] || [ "$VAULT_TLS_SKIP_VERIFY" = "1" ]; then
    curl -kfsS "$@"
  else
    curl -fsS "$@"
  fi
}

wait_for_vault() {
  i=1
  while [ "$i" -le 60 ]; do
    if curl_cmd "$VAULT_ADDR/v1/sys/health" >/dev/null 2>&1; then return 0; fi
    sleep 1
    i=$((i+1))
  done
  die "Vault not reachable at $VAULT_ADDR"
}

write_policy() {
  # HCL policy embedded in JSON.
  policy="path \\\"$KV_READ_PATH\\\" { capabilities = [\\\"read\\\"] }"
  curl_cmd \
    -H "X-Vault-Token: $VAULT_DEV_ROOT_TOKEN" \
    -H "Content-Type: application/json" \
    -X PUT \
    -d "{\"policy\":\"$policy\"}" \
    "$VAULT_ADDR/v1/sys/policies/acl/$POLICY_NAME" >/dev/null
}

create_app_token() {
  json=$(curl_cmd \
    -H "X-Vault-Token: $VAULT_DEV_ROOT_TOKEN" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "{\"policies\":[\"$POLICY_NAME\"],\"ttl\":\"$APP_TTL\"}" \
    "$VAULT_ADDR/v1/auth/token/create")

  token=$(printf '%s' "$json" | tr -d '\n' | sed -n 's/.*"client_token":"\([^"]*\)".*/\1/p')
  [ -n "$token" ] || die "Failed to create app token"
  printf '%s\n' "$token" >"$VAULT_APP_TOKEN_FILE"
  chmod 600 "$VAULT_APP_TOKEN_FILE" 2>/dev/null || true
}

main() {
  wait_for_vault

  # Seed secrets using root token
  export VAULT_TOKEN="$VAULT_DEV_ROOT_TOKEN"
  export VAULT_KV_PATH="${VAULT_KV_PATH:-secret/data/app}"
  export VAULT_TLS_SKIP_VERIFY
  sh /vault/seed.sh

  write_policy
  create_app_token

  log "Bootstrap OK: wrote app token to $VAULT_APP_TOKEN_FILE"
}

main "$@"

