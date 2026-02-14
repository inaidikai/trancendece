#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
ENV_FILE=${ENV_FILE:-"$PROJECT_ROOT/.env"}
SOURCE_FILE=${SOURCE_FILE:-"$SCRIPT_DIR/bootstrap.vault.source.sh"}
OUTPUT_FILE=${OUTPUT_FILE:-"$SCRIPT_DIR/bootstrap.vault.sh.gpg"}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Missing source script: $SOURCE_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${VAULT_BOOTSTRAP_GPG_PASSPHRASE:?Set VAULT_BOOTSTRAP_GPG_PASSPHRASE in .env}"

gpg --batch --yes --symmetric --cipher-algo AES256 \
  --pinentry-mode loopback --passphrase "$VAULT_BOOTSTRAP_GPG_PASSPHRASE" \
  --output "$OUTPUT_FILE" "$SOURCE_FILE"

chmod 600 "$OUTPUT_FILE"
echo "Encrypted bootstrap script -> $OUTPUT_FILE"
