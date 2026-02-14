const fastify = require("fastify")({ logger: true });
const jwt = require("@fastify/jwt");
const fastifyExpress = require("@fastify/express");
const express = require("express");
const db = require("./config/database");
const authRoutes = require("./routes/authRoutes");

const PORT = Number(process.env.PORT || 8000);
const DB_RETRY_ATTEMPTS = Number(process.env.DB_RETRY_ATTEMPTS || 30);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 2000);

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || "dev-super-secret-change-me",
});

fastify.get("/health", async () => ({ status: "Auth OK" }));

const ensureAuthSchema = async () => {
  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS two_fa_code TEXT,
      ADD COLUMN IF NOT EXISTS two_fa_code_expires TIMESTAMP
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique
    ON users (google_id)
    WHERE google_id IS NOT NULL
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
      user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL DEFAULT 'google',
      access_token TEXT,
      refresh_token TEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT oauth_tokens_user_provider_unique UNIQUE (user_id, provider)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider
    ON oauth_tokens (user_id, provider)
  `);

  await db.query(`
    DO $$
    BEGIN
      BEGIN
        EXECUTE 'UPDATE users SET avatar_url = COALESCE(avatar_url, avatar) WHERE avatar_url IS NULL';
      EXCEPTION WHEN undefined_column THEN
        NULL;
      END;
    END $$;
  `);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableDbError = (err) => {
  const code = err && err.code;
  return (
    code === "57P03" || // DB is starting up
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT"
  );
};

const waitForDatabaseReady = async () => {
  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await db.query("SELECT 1");
      return;
    } catch (err) {
      if (!isRetryableDbError(err) || attempt === DB_RETRY_ATTEMPTS) {
        throw err;
      }
      fastify.log.warn(
        `Database not ready (${err.code || err.message}); retry ${attempt}/${DB_RETRY_ATTEMPTS} in ${DB_RETRY_DELAY_MS}ms`
      );
      await sleep(DB_RETRY_DELAY_MS);
    }
  }
};

const start = async () => {
  try {
    await fastify.register(fastifyExpress);
    fastify.use(express.json());
    fastify.use(authRoutes);
    await waitForDatabaseReady();
    await ensureAuthSchema();

    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`auth-service listening on ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
