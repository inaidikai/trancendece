const fastify = require("fastify");
const httpProxy = require("@fastify/http-proxy");
const jwtPlugin = require("./plugins/jwt");

const app = fastify({ logger: true });
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function normalizeOrigin(origin) {
  return (origin || "").trim().replace(/\/+$/, "");
}

function getAllowedOrigins() {
  const rawOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "";
  const configured = rawOrigins
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

const allowedOrigins = new Set(getAllowedOrigins());

function isAllowedOrigin(origin) {
  return allowedOrigins.has(normalizeOrigin(origin));
}

app.addHook("onRequest", async (request, reply) => {
  const origin = request.headers.origin;
  const hasOriginHeader = Boolean(origin);

  if (hasOriginHeader && isAllowedOrigin(origin)) {
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Access-Control-Allow-Credentials", "true");
    reply.header(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-Requested-With"
    );
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    reply.header("Vary", "Origin");
  }

  if (request.method === "OPTIONS") {
    if (!hasOriginHeader || isAllowedOrigin(origin)) {
      return reply.code(204).send();
    }
    return reply.code(403).send({ error: `CORS origin denied: ${origin}` });
  }
});

// Register JWT plugin
app.register(jwtPlugin);

// Health check
app.get("/health", async () => {
  return { status: "gateway up" };
});

/* ROUTES / PROXY */
app.register(httpProxy, {
  upstream: "http://auth-service:8000",
  prefix: "/auth",
});

app.register(httpProxy, {
  upstream: "http://user-service:8001",
  prefix: "/users",
});

app.register(httpProxy, {
  upstream: "http://diary-service:8002",
  prefix: "/diary",
});

app.register(httpProxy, {
  upstream: "http://realtime-service:8003",
  prefix: "/socket.io/",
  rewritePrefix: "/socket.io/",
  websocket: true,
});


const start = async () => {
  try {
    await app.listen({ port: 8080, host: "0.0.0.0" });
    console.log("API Gateway running on port 8080");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
