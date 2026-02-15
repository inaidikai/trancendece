#!/usr/bin/env sh
set -eu

# Dev Vault ops sidecar:
# - auto-inits vault on first run (stores init.json in a named volume)
# - auto-unseals on every run
# - enables kv-v2
# - seeds kv secrets from container env vars
# - creates an app read token and writes it to /vault/dev-secrets/app-token
#
# This intentionally trades security for reproducibility in development.

VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
DEV_DIR="${VAULT_DEV_SECRETS_DIR:-/vault/dev-secrets}"
INIT_JSON="${VAULT_INIT_JSON:-$DEV_DIR/init.json}"
APP_TOKEN_FILE="${VAULT_APP_TOKEN_FILE:-$DEV_DIR/app-token}"

WATCH="${WATCH:-0}"
KEY_SHARES="${VAULT_KEY_SHARES:-3}"
KEY_THRESHOLD="${VAULT_KEY_THRESHOLD:-3}"

KV_MOUNT="${VAULT_KV_MOUNT:-kv}"
KV_APP_PATH="${VAULT_KV_APP_PATH:-app}"          # kv/app (kv-v2)
KV_POLICY_PATH="${VAULT_KV_POLICY_PATH:-kv/data/app}" # policy path for kv-v2 read

log() { printf '%s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

mkdir -p "$DEV_DIR"
chmod 700 "$DEV_DIR" 2>/dev/null || true

wait_for_vault() {
  i=0
  while [ "$i" -lt 90 ]; do
    if vault status >/dev/null 2>&1; then
      return 0
    fi
    i=$((i+1))
    sleep 1
  done
  die "Vault not reachable at $VAULT_ADDR"
}

json_compact() { tr -d '\n' <"$1"; }

json_get_root_token() {
  json_compact "$1" | sed -n 's/.*"root_token":"\\([^"]*\\)".*/\\1/p'
}

json_get_unseal_keys() {
  # prints one key per line
  json_compact "$1" \
    | sed -n 's/.*"unseal_keys_b64":\\[\\([^]]*\\)\\].*/\\1/p' \
    | tr -d '"' \
    | tr ',' '\n' \
    | awk 'NF{print}'
}

is_initialized() {
  # vault status outputs "Initialized true/false" even when sealed
  vault status 2>/dev/null | awk '/Initialized/ {print $2}' | grep -qi '^true$'
}

is_sealed() {
  vault status 2>/dev/null | awk '/Sealed/ {print $2}' | grep -qi '^true$'
}

init_if_needed() {
  if is_initialized; then
    log "Vault already initialized"
    [ -f "$INIT_JSON" ] || die "Vault initialized but $INIT_JSON missing (dev-secrets volume lost). Wipe vault-data and re-run."
    return 0
  fi

  log "Initializing Vault (dev mode). Writing $INIT_JSON"
  vault operator init -key-shares="$KEY_SHARES" -key-threshold="$KEY_THRESHOLD" -format=json >"$INIT_JSON"
  chmod 600 "$INIT_JSON" 2>/dev/null || true
}

unseal_if_needed() {
  if ! is_sealed; then
    log "Vault already unsealed"
    return 0
  fi

  [ -f "$INIT_JSON" ] || die "Missing $INIT_JSON (cannot unseal)"

  log "Unsealing Vault"
  i=0
  json_get_unseal_keys "$INIT_JSON" | while IFS= read -r key; do
    i=$((i+1))
    vault operator unseal "$key" >/dev/null
    [ "$i" -ge "$KEY_THRESHOLD" ] && break
  done
}

login_root() {
  root="$(json_get_root_token "$INIT_JSON" || true)"
  [ -n "$root" ] || die "Failed to read root_token from $INIT_JSON"
  export VAULT_TOKEN="$root"
}

enable_kv_v2() {
  if vault secrets list -format=json | grep -q "\"$KV_MOUNT/\""; then
    return 0
  fi
  log "Enabling KV v2 at $KV_MOUNT/"
  vault secrets enable -path="$KV_MOUNT" -version=2 kv >/dev/null
}

seed_kv() {
  # Seed using vault write + JSON so values can include spaces/quotes safely.
  # Note: this will write empty strings for missing env vars.
  json_escape() {
    # Minimal JSON escaping for strings.
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a;N;$!ba;s/\n/\\n/g'
  }

  tmp="${DEV_DIR}/seed.$$.json"
  cat >"$tmp" <<JSON
{
  "data": {
    "JWT_SECRET": "$(json_escape "${JWT_SECRET-}")",
    "FRONTEND_URL": "$(json_escape "${FRONTEND_URL-}")",
    "GOOGLE_CLIENT_ID": "$(json_escape "${GOOGLE_CLIENT_ID-}")",
    "GOOGLE_CLIENT_SECRET": "$(json_escape "${GOOGLE_CLIENT_SECRET-}")",
    "GOOGLE_REDIRECT_URI": "$(json_escape "${GOOGLE_REDIRECT_URI-}")",
    "EMAIL_HOST": "$(json_escape "${EMAIL_HOST-}")",
    "EMAIL_PORT": "$(json_escape "${EMAIL_PORT-}")",
    "EMAIL_SECURE": "$(json_escape "${EMAIL_SECURE-}")",
    "EMAIL_USER": "$(json_escape "${EMAIL_USER-}")",
    "EMAIL_PASSWORD": "$(json_escape "${EMAIL_PASSWORD-}")",
    "EMAIL_FROM": "$(json_escape "${EMAIL_FROM-}")",
    "PGHOST": "$(json_escape "${PGHOST-}")",
    "PGPORT": "$(json_escape "${PGPORT-}")",
    "PGUSER": "$(json_escape "${PGUSER-}")",
    "PGPASSWORD": "$(json_escape "${PGPASSWORD-}")",
    "PGDATABASE": "$(json_escape "${PGDATABASE-}")",
    "CORS_ORIGINS": "$(json_escape "${CORS_ORIGINS-}")"
  }
}
JSON

  log "Seeding secrets to $KV_POLICY_PATH"
  vault write "$KV_POLICY_PATH" @"$tmp" >/dev/null
  rm -f "$tmp" 2>/dev/null || true
}

create_app_policy_and_token() {
  policy_name="${VAULT_APP_POLICY_NAME:-app-read}"
  token_ttl="${VAULT_APP_TOKEN_TTL:-1h}"
  use_limit="${VAULT_APP_TOKEN_USE_LIMIT:-1}"

  if [ "$WATCH" = "1" ]; then
    token_ttl="${VAULT_APP_TOKEN_TTL_WATCH:-720h}"
    use_limit="${VAULT_APP_TOKEN_USE_LIMIT_WATCH:-0}" # 0 means unlimited uses
    log "WATCH=1 -> long-lived token ($token_ttl)"
  else
    log "WATCH=0 -> one-time token ($token_ttl, use_limit=$use_limit)"
  fi

  vault policy write "$policy_name" - >/dev/null <<EOF
path "$KV_POLICY_PATH" {
  capabilities = ["read"]
}
EOF

  if [ "$use_limit" = "0" ]; then
    tok_json=$(vault token create -policy="$policy_name" -ttl="$token_ttl" -format=json)
  else
    tok_json=$(vault token create -policy="$policy_name" -ttl="$token_ttl" -use-limit="$use_limit" -format=json)
  fi

  token=$(printf '%s' "$tok_json" | tr -d '\n' | sed -n 's/.*"client_token":"\\([^"]*\\)".*/\\1/p')
  [ -n "$token" ] || die "Failed to create app token"

  printf '%s\n' "$token" >"$APP_TOKEN_FILE"
  chmod 600 "$APP_TOKEN_FILE" 2>/dev/null || true
  log "Wrote app token to $APP_TOKEN_FILE"
}

main() {
  wait_for_vault
  init_if_needed
  unseal_if_needed
  login_root
  enable_kv_v2
  seed_kv
  create_app_policy_and_token

  log "Vault dev-ops done. Keeping container alive."
  tail -f /dev/null
}

main "$@"
