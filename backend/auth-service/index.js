const fastify = require("fastify");
const jwt = require("@fastify/jwt");

const app = fastify();
const PORT = 8000;

app.register(jwt, {
  secret: process.env.JWT_SECRET || "supersecret",
});

app.get("/health", async () => ({ status: "Auth OK" }));

// minimal dev login: accepts anything, issues token
app.post("/login", async (req, reply) => {
  const { email } = req.body || {};
  if (!email) return reply.code(400).send({ error: "email required" });

  const token = app.jwt.sign({ userId: email }); // payload uses userId (important)
  return { token };
});

app.post("/register", async (req, reply) => {
  const { email } = req.body || {};
  if (!email) return reply.code(400).send({ error: "email required" });

  const token = app.jwt.sign({ userId: email });
  return { token };
});

app.listen({ port: PORT, host: "0.0.0.0" });
