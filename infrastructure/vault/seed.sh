#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
ENV_FILE=${ENV_FILE:-"$PROJECT_ROOT/.env"}

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

VAULT_ADDR=${VAULT_ADDR:-http://vault:8200}
VAULT_TOKEN=${VAULT_TOKEN:-my-secret-token}
VAULT_KV_PATH=${VAULT_KV_PATH:-kv/data/app}

wait_for_vault() {
  for i in $(seq 1 30); do
    if curl -fsS "$VAULT_ADDR/v1/sys/health" >/dev/null; then
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

  if [ "$status" != "200" ]; then
    curl -fsS -H "X-Vault-Token: $VAULT_TOKEN" \
      -H "Content-Type: application/json" \
      -X POST \
      -d '{"type":"kv","options":{"version":"2"}}' \
      "$VAULT_ADDR/v1/sys/mounts/kv" >/dev/null
  fi
}

build_payload() {
  node <<'JSON'
const payload = {
  data: {
    JWT_SECRET: process.env.JWT_SECRET || "dev-super-secret-change-me",
    FRONTEND_URL: process.env.FRONTEND_URL || "https://localhost:5173",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "your-client-id-here",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "your-client-secret-here",
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "https://localhost:8081/auth/google/callback",
    EMAIL_HOST: process.env.EMAIL_HOST || "smtp.gmail.com",
    EMAIL_PORT: process.env.EMAIL_PORT || "587",
    EMAIL_SECURE: process.env.EMAIL_SECURE || "false",
    EMAIL_USER: process.env.EMAIL_USER || "your-email@gmail.com",
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || "your-app-password",
    EMAIL_FROM: process.env.EMAIL_FROM || process.env.EMAIL_USER || "your-email@gmail.com",
    PGHOST: process.env.PGHOST || "postgres",
    PGPORT: process.env.PGPORT || "5432",
    PGUSER: process.env.PGUSER || "postgres",
    PGPASSWORD: process.env.PGPASSWORD || "postgres",
    PGDATABASE: process.env.PGDATABASE || "auth_db",
    CORS_ORIGINS: process.env.CORS_ORIGINS || "https://localhost:5173,https://127.0.0.1:5173",
  },
};
process.stdout.write(JSON.stringify(payload));
JSON
}

wait_for_vault
enable_kv_v2

payload=$(build_payload)

curl -fsS -H "X-Vault-Token: $VAULT_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  -d "$payload" \
  "$VAULT_ADDR/v1/${VAULT_KV_PATH}" >/dev/null

echo "Vault seeded at ${VAULT_KV_PATH}"
