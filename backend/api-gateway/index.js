const fastify = require("fastify");
const httpProxy = require("@fastify/http-proxy");
const jwtPlugin = require("./plugins/jwt");

const app = fastify({ logger: true });

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
