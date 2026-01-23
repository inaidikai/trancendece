const fp = require("fastify-plugin");
const jwt = require("@fastify/jwt");

/**
 * JWT Authentication Plugin
 * Verifies JWT tokens on all protected routes
 * Skips: /health, /auth/login, /auth/register
 */
module.exports = fp(async (app, options) => {
  // Register JWT plugin
  app.register(jwt, {
    secret: process.env.JWT_SECRET || "supersecret",
  });

  // JWT verification hook
  app.addHook("preHandler", async (request, reply) => {
    // Skip JWT verification for public endpoints
    const publicRoutes = [
      "/health",
      "/auth/login",
      "/auth/register",
      "/auth/health",
    ];

    if (publicRoutes.some((route) => request.url.startsWith(route))) {
      return;
    }

    try {
      await request.jwtVerify();

      // Add user id to headers for downstream services
      if (request.user && request.user.id) {
        request.headers["x-user-id"] = request.user.id;
      }
    } catch (err) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });
});
