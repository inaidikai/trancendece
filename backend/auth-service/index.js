const fastify = require("fastify")({ logger: true });
const jwt = require("@fastify/jwt");
const fastifyExpress = require("@fastify/express");
const express = require("express");
const db = require("./config/database");
const authRoutes = require("./routes/authRoutes");

const PORT = Number(process.env.PORT || 8000);

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || "dev-super-secret-change-me",
});

fastify.get("/health", async () => ({ status: "Auth OK" }));

const ensureAuthSchema = async () => {
  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS two_fa_code TEXT,
      ADD COLUMN IF NOT EXISTS two_fa_code_expires TIMESTAMP
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

const start = async () => {
  try {
    await fastify.register(fastifyExpress);
    fastify.use(express.json());
    fastify.use(authRoutes);
    await ensureAuthSchema();

    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`auth-service listening on ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
