const fastify = require("fastify")({ logger: true });
const createWebSocketServer = require("./websocket/websocketServer");

fastify.get("/health", async () => ({ status: "Realtime OK" }));

fastify.post("/trigger/notification", async (request, reply) => {
  const { userId, notification } = request.body || {};
  if (!userId || !notification) {
    return reply.code(400).send({ error: "userId and notification are required" });
  }

  if (!fastify.io) {
    return reply.code(503).send({ error: "Socket server not ready" });
  }

  fastify.io.to(`user_${userId}`).emit("notification:created", {
    notification,
    timestamp: Date.now(),
  });

  return { ok: true };
});

const io = createWebSocketServer(fastify.server);
fastify.decorate("io", io);

fastify.listen({ port: 8003, host: "0.0.0.0" });
