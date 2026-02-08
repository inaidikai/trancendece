const fastify = require("fastify")({ logger: true });
const createWebSocketServer = require("./websocket/websocketServer");

fastify.get("/health", async () => ({ status: "Realtime OK" }));

createWebSocketServer(fastify.server);

fastify.listen({ port: 8003, host: "0.0.0.0" });
