const fastify = require("fastify")({ logger: true });
const jwt = require("@fastify/jwt");

const PORT = Number(process.env.PORT || 8000);

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || "supersecret",
});

fastify.get("/health", async () => ({ status: "Auth OK" }));

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
