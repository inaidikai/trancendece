#!/usr/bin/env sh
set -eu

VAULT_ADDR=${VAULT_ADDR:-http://vault:8200}
VAULT_TOKEN=${VAULT_TOKEN:-my-secret-token}
VAULT_KV_PATH=${VAULT_KV_PATH:-kv/data/app}

wait_for_vault() {
  for i in $(seq 1 30); do
    if curl -s "$VAULT_ADDR/v1/sys/health" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  echo "Vault not reachable" >&2
  return 1
}

enable_kv_v2() {
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Vault-Token: $VAULT_TOKEN" \
    "$VAULT_ADDR/v1/sys/mounts/kv")

  if [ "$status" = "404" ]; then
    curl -sS -H "X-Vault-Token: $VAULT_TOKEN" \
      -H "Content-Type: application/json" \
      -X POST \
      -d '{"type":"kv","options":{"version":"2"}}' \
      "$VAULT_ADDR/v1/sys/mounts/kv" >/dev/null
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
    "JWT_SECRET": "${JWT_SECRET}",
    "FRONTEND_URL": "${FRONTEND_URL}",
    "GOOGLE_CLIENT_ID": "${GOOGLE_CLIENT_ID}",
    "GOOGLE_CLIENT_SECRET": "${GOOGLE_CLIENT_SECRET}",
    "GOOGLE_REDIRECT_URI": "${GOOGLE_REDIRECT_URI}",
    "EMAIL_HOST": "${EMAIL_HOST}",
    "EMAIL_PORT": "${EMAIL_PORT}",
    "EMAIL_SECURE": "${EMAIL_SECURE}",
    "EMAIL_USER": "${EMAIL_USER}",
    "EMAIL_PASSWORD": "${EMAIL_PASSWORD}",
    "EMAIL_FROM": "${EMAIL_FROM}",
    "PGHOST": "${PGHOST}",
    "PGPORT": "${PGPORT}",
    "PGUSER": "${PGUSER}",
    "PGPASSWORD": "${PGPASSWORD}",
    "PGDATABASE": "${PGDATABASE}",
    "CORS_ORIGINS": "${CORS_ORIGINS}"
  }
}
JSON
}

wait_for_vault
enable_kv_v2

payload=$(build_payload)

curl -sS -H "X-Vault-Token: $VAULT_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  -d "$payload" \
  "$VAULT_ADDR/v1/${VAULT_KV_PATH}" >/dev/null

echo "Vault seeded at ${VAULT_KV_PATH}"
