#!/usr/bin/env bash
set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_KV_MOUNT="${VAULT_KV_MOUNT:-kv}"
VAULT_KV_PATH="${VAULT_KV_PATH:-kv/data/app}"

# Copy this file to bootstrap.vault.source.sh and set real values locally.
VAULT_ROOT_TOKEN="CHANGE_ME_ROOT_TOKEN"
VAULT_UNSEAL_KEYS=(
  "CHANGE_ME_UNSEAL_KEY_1"
  "CHANGE_ME_UNSEAL_KEY_2"
  "CHANGE_ME_UNSEAL_KEY_3"
)

# Secrets that will be written to Vault after unseal.
JWT_SECRET="CHANGE_ME_JWT_SECRET"
FRONTEND_URL="https://localhost:5173"
GOOGLE_CLIENT_ID="CHANGE_ME_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="CHANGE_ME_GOOGLE_CLIENT_SECRET"
GOOGLE_REDIRECT_URI="https://localhost:5173/auth/google/callback"
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USER="CHANGE_ME_EMAIL_USER"
EMAIL_PASSWORD="CHANGE_ME_EMAIL_PASSWORD"
EMAIL_FROM='"CHANGE_ME_EMAIL_FROM"'
PGHOST="postgres"
PGPORT="5432"
PGUSER="postgres"
PGPASSWORD="postgres"
PGDATABASE="auth_db"
CORS_ORIGINS="https://localhost:5173,https://127.0.0.1:5173"

wait_for_vault() {
  for _ in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$VAULT_ADDR/v1/sys/health" || true)
    if [[ "$code" == "200" || "$code" == "429" || "$code" == "472" || "$code" == "473" || "$code" == "501" || "$code" == "503" ]]; then
      return 0
    fi
    sleep 1
  done
  echo "Vault is not reachable at $VAULT_ADDR" >&2
  return 1
}

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a;N;$!ba;s/\n/\\n/g'
}

check_not_placeholder() {
  local value="$1"
  local field="$2"
  if [[ "$value" == CHANGE_ME_* ]]; then
    echo "$field still has placeholder value. Update bootstrap.vault.source.sh and re-encrypt." >&2
    exit 1
  fi
}

unseal_vault() {
  check_not_placeholder "$VAULT_ROOT_TOKEN" "VAULT_ROOT_TOKEN"
  for key in "${VAULT_UNSEAL_KEYS[@]}"; do
    check_not_placeholder "$key" "VAULT_UNSEAL_KEYS"
    curl -fsS \
      -H "Content-Type: application/json" \
      -X POST \
      -d "{\"key\":\"$key\"}" \
      "$VAULT_ADDR/v1/sys/unseal" >/dev/null
  done
}

enable_kv_v2_if_needed() {
  local mounts
  mounts=$(curl -fsS \
    -H "X-Vault-Token: $VAULT_ROOT_TOKEN" \
    "$VAULT_ADDR/v1/sys/mounts")

  if ! printf '%s' "$mounts" | grep -q "\"$VAULT_KV_MOUNT/\""; then
    curl -fsS \
      -H "X-Vault-Token: $VAULT_ROOT_TOKEN" \
      -H "Content-Type: application/json" \
      -X POST \
      -d '{"type":"kv","options":{"version":"2"}}' \
      "$VAULT_ADDR/v1/sys/mounts/$VAULT_KV_MOUNT" >/dev/null
  fi
}

write_app_secrets() {
  local payload
  payload=$(cat <<JSON
{
  "data": {
    "JWT_SECRET": "$(json_escape "$JWT_SECRET")",
    "FRONTEND_URL": "$(json_escape "$FRONTEND_URL")",
    "GOOGLE_CLIENT_ID": "$(json_escape "$GOOGLE_CLIENT_ID")",
    "GOOGLE_CLIENT_SECRET": "$(json_escape "$GOOGLE_CLIENT_SECRET")",
    "GOOGLE_REDIRECT_URI": "$(json_escape "$GOOGLE_REDIRECT_URI")",
    "EMAIL_HOST": "$(json_escape "$EMAIL_HOST")",
    "EMAIL_PORT": "$(json_escape "$EMAIL_PORT")",
    "EMAIL_SECURE": "$(json_escape "$EMAIL_SECURE")",
    "EMAIL_USER": "$(json_escape "$EMAIL_USER")",
    "EMAIL_PASSWORD": "$(json_escape "$EMAIL_PASSWORD")",
    "EMAIL_FROM": "$(json_escape "$EMAIL_FROM")",
    "PGHOST": "$(json_escape "$PGHOST")",
    "PGPORT": "$(json_escape "$PGPORT")",
    "PGUSER": "$(json_escape "$PGUSER")",
    "PGPASSWORD": "$(json_escape "$PGPASSWORD")",
    "PGDATABASE": "$(json_escape "$PGDATABASE")",
    "CORS_ORIGINS": "$(json_escape "$CORS_ORIGINS")"
  }
}
JSON
)

  curl -fsS \
    -H "X-Vault-Token: $VAULT_ROOT_TOKEN" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "$payload" \
    "$VAULT_ADDR/v1/$VAULT_KV_PATH" >/dev/null
}

wait_for_vault
unseal_vault
enable_kv_v2_if_needed
write_app_secrets

echo "Vault unsealed and secrets written to $VAULT_KV_PATH"
