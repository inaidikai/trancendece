const fastify = require("fastify")({ logger: true });
const jwt = require("@fastify/jwt");

const PORT = Number(process.env.PORT || 8000);
const profiles = new Map();

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || "supersecret",
});

fastify.get("/health", async () => ({ status: "Auth OK" }));

async function requireAuth(request, reply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

fastify.post("/login", async (req, reply) => {
  const { email } = req.body || {};
  if (!email) return reply.code(400).send({ error: "email required" });

  const token = fastify.jwt.sign({ userId: email });
  return { token };
});

fastify.post("/register", async (req, reply) => {
  const { email } = req.body || {};
  if (!email) return reply.code(400).send({ error: "email required" });

  const token = fastify.jwt.sign({ userId: email });
  return { token };
});

fastify.get("/me", { preHandler: requireAuth }, async (req, reply) => {
  const userId = req.user?.userId;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });
  const profile = profiles.get(userId) || {};
  return { id: userId, ...profile };
});

fastify.post("/profile", { preHandler: requireAuth }, async (req, reply) => {
  const userId = req.user?.userId;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const body = req.body || {};
  const current = profiles.get(userId) || {};
  const next = {
    full_name: body.full_name ?? body.fullName ?? current.full_name ?? null,
    bio: body.bio ?? current.bio ?? null,
    avatar_url: body.avatar_url ?? body.avatar ?? current.avatar_url ?? null,
  };
  profiles.set(userId, next);

  return { message: "Profile updated", user: { id: userId, ...next } };
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`auth-service listening on ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
