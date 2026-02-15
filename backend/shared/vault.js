const DEFAULT_KV_PATHS = 'kv/data/app';
const { Agent } = require('undici');

function boolEnv(name, def = false) {
  const v = String(process.env[name] || '').toLowerCase();
  if (!v) return def;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function splitPaths(raw) {
  return String(raw || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

function toEnvValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

async function fetchJson(url, headers, fetchOptions = {}) {
  const res = await fetch(url, { headers, ...fetchOptions });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Vault request failed: ${res.status} ${res.statusText}`);
    err.details = text;
    throw err;
  }
  return res.json();
}

async function loadVaultSecrets(options = {}) {
  const logger = options.logger || console;
  const addr = process.env.VAULT_ADDR;
  const token = process.env.VAULT_TOKEN;
  const namespace = process.env.VAULT_NAMESPACE;
  const paths = splitPaths(process.env.VAULT_KV_PATHS || DEFAULT_KV_PATHS);
  const override = String(process.env.VAULT_OVERRIDE || '').toLowerCase() === 'true';
  const failFast = String(process.env.VAULT_FAIL_FAST || '').toLowerCase() === 'true';
  const tlsSkipVerify = boolEnv('VAULT_TLS_SKIP_VERIFY', false);

  // Only relax TLS for Vault calls, not globally.
  const fetchOptions = tlsSkipVerify
    ? { dispatcher: new Agent({ connect: { rejectUnauthorized: false } }) }
    : {};

  if (!addr || !token) {
    logger.info('Vault not configured; skipping secret load.');
    return { loaded: false, reason: 'missing VAULT_ADDR or VAULT_TOKEN' };
  }

  const headers = {
    'X-Vault-Token': token,
  };
  if (namespace) headers['X-Vault-Namespace'] = namespace;

  const collected = {};

  for (const path of paths) {
    try {
      const url = `${addr.replace(/\/$/, '')}/v1/${path}`;
      const data = await fetchJson(url, headers, fetchOptions);
      if (!data) continue;

      const payload = data?.data?.data || data?.data || {};
      Object.assign(collected, payload);
    } catch (err) {
      logger.error(`Vault load failed for ${path}: ${err.message}`);
      if (failFast) throw err;
    }
  }

  const keys = Object.keys(collected);
  keys.forEach((key) => {
    if (!override && process.env[key] !== undefined) return;
    process.env[key] = toEnvValue(collected[key]);
  });

  logger.info(`Vault secrets loaded: ${keys.length} keys`);
  return { loaded: true, keys };
}

module.exports = {
  loadVaultSecrets,
};
