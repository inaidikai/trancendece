#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
ENV_FILE=${ENV_FILE:-"$PROJECT_ROOT/.env"}
ENCRYPTED_SCRIPT=${ENCRYPTED_SCRIPT:-"$SCRIPT_DIR/bootstrap.vault.sh.gpg"}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENCRYPTED_SCRIPT" ]]; then
  echo "Missing encrypted script: $ENCRYPTED_SCRIPT" >&2
  echo "Run infrastructure/vault/encrypt-bootstrap.sh first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${VAULT_BOOTSTRAP_GPG_PASSPHRASE:?Set VAULT_BOOTSTRAP_GPG_PASSPHRASE in .env}"

gpg --batch --quiet --decrypt --pinentry-mode loopback \
  --passphrase "$VAULT_BOOTSTRAP_GPG_PASSPHRASE" "$ENCRYPTED_SCRIPT" | bash
