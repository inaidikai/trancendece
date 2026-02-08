const fp = require("fastify-plugin");
const jwt = require("@fastify/jwt");

module.exports = fp(async function jwtPlugin(app) {
  app.register(jwt, {
    secret: process.env.JWT_SECRET || "dev-super-secret-change-me",
  });

  app.decorate("authenticate", async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });

  // Global auth hook with safe exclusions
  app.addHook("preHandler", async (request, reply) => {
    const url = request.raw.url || "";

    // ✅ public routes
    if (url.startsWith("/health")) return;
    if (url.startsWith("/auth")) return;

    // ✅ Socket.IO handshake + upgrade must pass through gateway;
    // realtime-service will authenticate using socket.handshake.auth.token
    if (url.startsWith("/socket.io")) return;

    // everything else requires Authorization: Bearer <JWT>
    return app.authenticate(request, reply);
  });
});
