#!/usr/bin/env sh
set -eu

VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
VAULT_APP_TOKEN_FILE="${VAULT_APP_TOKEN_FILE:-/vault/shared/app-token}"
VAULT_INIT_FILE="${VAULT_INIT_FILE:-/vault/shared/init.json}"
VAULT_KV_PATH="${VAULT_KV_PATH:-secret/data/app}"
VAULT_APP_POLICY_NAME="${VAULT_APP_POLICY_NAME:-app-read}"
VAULT_APP_TOKEN_TTL="${VAULT_APP_TOKEN_TTL:-24h}"

log() { printf '%s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

extract_json_bool() {
  key="$1"
  input="$2"
  printf '%s' "$input" | tr -d '\n' | sed -n "s/.*\"$key\":[[:space:]]*\\(true\\|false\\).*/\\1/p"
}

extract_json_string() {
  key="$1"
  input="$2"
  printf '%s' "$input" | tr -d '\n' | sed -n "s/.*\"$key\":[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p"
}

wait_for_api() {
  i=1
  while [ "$i" -le 120 ]; do
    output="$(vault status 2>&1 || true)"
    if ! printf '%s' "$output" | grep -Eiq 'connection refused|no such host|i/o timeout|context deadline exceeded'; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  die "Vault API not reachable at $VAULT_ADDR"
}

ensure_initialized() {
  status_json="$(vault status -format=json 2>/dev/null || true)"
  initialized="$(extract_json_bool initialized "$status_json")"
  if [ "$initialized" = "true" ]; then
    return 0
  fi

  if [ -s "$VAULT_INIT_FILE" ]; then
    die "Vault is uninitialized but $VAULT_INIT_FILE already exists; remove stale init file or fix storage."
  fi

  log "Initializing Vault (single unseal key for local development workflow)..."
  umask 077
  vault operator init -key-shares=1 -key-threshold=1 -format=json >"$VAULT_INIT_FILE"
}

read_unseal_key() {
  [ -s "$VAULT_INIT_FILE" ] || die "Missing $VAULT_INIT_FILE; cannot unseal."
  key="$(tr -d '\n' <"$VAULT_INIT_FILE" | sed -n 's/.*"unseal_keys_b64":[[:space:]]*\[[[:space:]]*"\([^"]*\)".*/\1/p')"
  [ -n "$key" ] || die "Unable to read unseal key from $VAULT_INIT_FILE"
  printf '%s' "$key"
}

read_root_token() {
  [ -s "$VAULT_INIT_FILE" ] || die "Missing $VAULT_INIT_FILE; cannot read root token."
  token="$(tr -d '\n' <"$VAULT_INIT_FILE" | sed -n 's/.*"root_token":[[:space:]]*"\([^"]*\)".*/\1/p')"
  [ -n "$token" ] || die "Unable to read root token from $VAULT_INIT_FILE"
  printf '%s' "$token"
}

ensure_unsealed() {
  status_json="$(vault status -format=json 2>/dev/null || true)"
  sealed="$(extract_json_bool sealed "$status_json")"
  if [ "$sealed" != "true" ]; then
    return 0
  fi

  log "Unsealing Vault..."
  unseal_key="$(read_unseal_key)"
  vault operator unseal "$unseal_key" >/dev/null
}

write_policy() {
  policy_file="$(mktemp)"
  cat >"$policy_file" <<'EOF'
path "secret/data/app" {
  capabilities = ["read"]
}

path "secret/metadata/app" {
  capabilities = ["read", "list"]
}
EOF
  vault policy write "$VAULT_APP_POLICY_NAME" "$policy_file" >/dev/null
  rm -f "$policy_file"
}

create_app_token() {
  json="$(vault token create -policy="$VAULT_APP_POLICY_NAME" -ttl="$VAULT_APP_TOKEN_TTL" -format=json)"
  token="$(extract_json_string client_token "$json")"
  [ -n "$token" ] || die "Failed to create app token"
  umask 077
  printf '%s\n' "$token" >"$VAULT_APP_TOKEN_FILE"
}

main() {
  export VAULT_ADDR
  wait_for_api
  ensure_initialized
  ensure_unsealed

  export VAULT_TOKEN="$(read_root_token)"

  vault secrets enable -path=secret -version=2 kv >/dev/null 2>&1 || true
  write_policy

  export VAULT_KV_PATH
  /vault/seed.sh

  create_app_token
  log "Vault bootstrap complete: token in $VAULT_APP_TOKEN_FILE"
}

main "$@"
