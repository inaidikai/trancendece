# Vault bootstrap flow (production-style)

## What changed
- Vault now runs in `server` mode (not dev mode).
- `vault-seed` auto-container was removed.
- You now unseal + seed manually through an encrypted GPG script.

## Files
- `config.hcl`: Vault server config.
- `bootstrap.vault.sh.gpg`: Encrypted script that does unseal + write secrets.
- `run-bootstrap.sh`: Decrypts and runs `bootstrap.vault.sh.gpg`.
- `encrypt-bootstrap.sh`: Re-encrypts after you update the source script.

## First-time setup
1. Start Vault:
   ```bash
   cd infrastructure
   docker compose up -d vault
   ```
2. Initialize Vault once and save output securely:
   ```bash
   docker compose exec vault vault operator init -key-shares=3 -key-threshold=3
   ```
3. Put the returned `Unseal Key 1..3` and `Initial Root Token` into `bootstrap.vault.source.sh`.
4. Set `VAULT_BOOTSTRAP_GPG_PASSPHRASE` in `.env` to a strong passphrase.
5. Encrypt script:
   ```bash
   ./infrastructure/vault/encrypt-bootstrap.sh
   ```

## Manual unseal + seed (every restart that seals Vault)
```bash
./infrastructure/vault/run-bootstrap.sh
```

This command decrypts the script in-memory and executes it:
- unseals Vault with your keys,
- enables `kv-v2` mount (`kv/`) if missing,
- writes app secrets to `kv/data/app`.

## Rotate/update secrets
1. Edit `bootstrap.vault.source.sh`.
2. Re-encrypt:
   ```bash
   ./infrastructure/vault/encrypt-bootstrap.sh
   ```
3. Run again:
   ```bash
   ./infrastructure/vault/run-bootstrap.sh
   ```
