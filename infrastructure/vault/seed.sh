#!/usr/bin/env sh
set -eu

VAULT_ADDR=${VAULT_ADDR:-https://vault:8200}
VAULT_TOKEN=${VAULT_TOKEN:-my-secret-token}
VAULT_KV_PATH=${VAULT_KV_PATH:-secret/data/app}
VAULT_TLS_SKIP_VERIFY=${VAULT_TLS_SKIP_VERIFY:-true}

curl_cmd() {
  if [ "$VAULT_TLS_SKIP_VERIFY" = "true" ] || [ "$VAULT_TLS_SKIP_VERIFY" = "1" ]; then
    curl -kfsS "$@"
  else
    curl -fsS "$@"
  fi
}

json_escape() {
  # Escape for JSON string context.
  # shellcheck disable=SC2001
  printf '%s' "$1" | sed \
    -e 's/\\/\\\\/g' \
    -e 's/"/\\"/g' \
    -e ':a;N;$!ba;s/\n/\\n/g'
}

wait_for_vault() {
  i=1
  while [ "$i" -le 30 ]; do
    if curl_cmd "$VAULT_ADDR/v1/sys/health" >/dev/null 2>&1; then return 0; fi
    sleep 1
    i=$((i+1))
  done
  echo "Vault not reachable" >&2
  return 1
}

enable_kv_v2() {
  # Dev Vault already mounts KV v2 at secret/. Keep this as a no-op helper.
  status=$(curl_cmd -o /dev/null -w "%{http_code}" \
    -H "X-Vault-Token: $VAULT_TOKEN" \
    "$VAULT_ADDR/v1/sys/mounts/secret")

  if [ "$status" = "404" ]; then
    curl_cmd -H "X-Vault-Token: $VAULT_TOKEN" \
      -H "Content-Type: application/json" \
      -X POST \
      -d '{"type":"kv","options":{"version":"2"}}' \
      "$VAULT_ADDR/v1/sys/mounts/secret" >/dev/null
  fi
}

build_payload() {
  JWT_SECRET=${JWT_SECRET:-dev-super-secret-change-me}
  FRONTEND_URL=${FRONTEND_URL:-https://localhost:5173}
  GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-your-client-id-here}
  GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-your-client-secret-here}
  GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI:-https://localhost:8081/auth/google/callback}
  EMAIL_HOST=${EMAIL_HOST:-smtp.gmail.com}
  EMAIL_PORT=${EMAIL_PORT:-587}
  EMAIL_SECURE=${EMAIL_SECURE:-false}
  EMAIL_USER=${EMAIL_USER:-your-email@gmail.com}
  EMAIL_PASSWORD=${EMAIL_PASSWORD:-your-app-password}
  EMAIL_FROM=${EMAIL_FROM:-noreply@auth.com}
  PGHOST=${PGHOST:-postgres}
  PGPORT=${PGPORT:-5432}
  PGUSER=${PGUSER:-postgres}
  PGPASSWORD=${PGPASSWORD:-postgres}
  PGDATABASE=${PGDATABASE:-auth_db}
  CORS_ORIGINS=${CORS_ORIGINS:-https://localhost:5173,https://127.0.0.1:5173}

  cat <<JSON
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
}

wait_for_vault
enable_kv_v2

payload=$(build_payload)

curl_cmd -H "X-Vault-Token: $VAULT_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  -d "$payload" \
  "$VAULT_ADDR/v1/${VAULT_KV_PATH}" >/dev/null

echo "Vault seeded at ${VAULT_KV_PATH}"
