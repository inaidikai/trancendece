const { Server } = require("socket.io");
const authenticateSocket = require("../middleware/authenticateSocket");
const registerLola = require("./registerlala");

module.exports = function createWebSocketServer(httpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: process.env.FRONTEND_URL || "*",
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
