const DEFAULT_KV_PATHS = 'secret/data/app';
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');

function readTokenFile(path) {
  if (!path) return '';
  try {
    return String(fs.readFileSync(path, 'utf8') || '').trim();
  } catch {
    return '';
  }
}

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

function requestJson(urlStr, headers, options = {}) {
  const url = new URL(urlStr);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;

  const reqOptions = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    method: 'GET',
    headers,
  };

  if (isHttps && options.tlsSkipVerify) reqOptions.rejectUnauthorized = false;

  return new Promise((resolve, reject) => {
    const req = client.request(reqOptions, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 404) return resolve(null);
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`Vault request failed: ${res.statusCode} ${res.statusMessage || ''}`.trim());
          err.details = body;
          return reject(err);
        }
        try {
          return resolve(body ? JSON.parse(body) : {});
        } catch {
          const err = new Error('Vault response was not valid JSON');
          err.details = body;
          return reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function loadVaultSecrets(options = {}) {
  const logger = options.logger || console;
  const addr = process.env.VAULT_ADDR;
  const tokenFile = process.env.VAULT_TOKEN_FILE;
  let token = process.env.VAULT_TOKEN || readTokenFile(tokenFile);
  const namespace = process.env.VAULT_NAMESPACE;
  const paths = splitPaths(process.env.VAULT_KV_PATHS || DEFAULT_KV_PATHS);
  const override = String(process.env.VAULT_OVERRIDE || '').toLowerCase() === 'true';
  const failFast = String(process.env.VAULT_FAIL_FAST || '').toLowerCase() === 'true';
  const tlsSkipVerify = boolEnv('VAULT_TLS_SKIP_VERIFY', false);

  // If token is produced by a bootstrap container, wait briefly on cold starts.
  if (addr && !token && tokenFile) {
    const maxMs = Number(process.env.VAULT_TOKEN_WAIT_MS || 30_000);
    const intervalMs = Number(process.env.VAULT_TOKEN_WAIT_INTERVAL_MS || 250);
    const started = Date.now();
    while (!token && Date.now() - started < maxMs) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, intervalMs));
      token = readTokenFile(tokenFile);
    }
  }

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
      const data = await requestJson(url, headers, { tlsSkipVerify });
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
