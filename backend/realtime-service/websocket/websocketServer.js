const { Server } = require("socket.io");
const authenticateSocket = require("../middleware/authenticateSocket");
const registerLola = require("./registerlala");

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

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

module.exports = function createWebSocketServer(httpServer) {
  const allowedOrigins = getAllowedOrigins();

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const normalizedOrigin = normalizeOrigin(origin);
        if (allowedOrigins.includes(normalizedOrigin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS origin denied: ${origin}`), false);
      },
      credentials: true,
    },
  });

  // Auth happens once here
  io.use(authenticateSocket);

  // After auth, attach Lola behavior
  io.on("connection", (socket) => {
    if (!socket.data?.userId) return socket.disconnect(true);
    registerLola(io, socket);
  });

  return io;
};
