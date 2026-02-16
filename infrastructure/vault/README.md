# Vault bootstrap flow

Vault runs in normal `server` mode (not `-dev`) with file storage at `/vault/file`.

## Files
- `config.hcl`: Vault server configuration.
- `bootstrap.sh`: Auto init/unseal/bootstrap entrypoint for `vault-bootstrap`.
- `store-env-secrets.sh`: Writes environment values to `secret/data/app`.

## How it works
`make vault-bootstrap` (also called by `make`) now does:
1. Start Vault server.
2. Initialize Vault once if needed and persist init material at `/vault/shared/init.json`.
3. Unseal Vault automatically using the stored unseal key.
4. Ensure `secret/` is mounted as KV v2.
5. Store env secrets into `secret/data/app`.
6. Create/update read policy and write app token to `/vault/shared/app-token`.

App services then read Vault secrets using `/vault/shared/app-token`.
