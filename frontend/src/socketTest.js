import { io } from "socket.io-client";

export function testSocket(token) {
  console.log("socket token exists?", !!token);

  const socket = io("http://localhost:8081", {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket"],   // ✅ force WS only
    upgrade: false,              // ✅ don't try polling → WS upgrade
  });

  socket.on("connect", () => console.log("connected", socket.id));
  socket.on("ready", (msg) => console.log("ready", msg));
  socket.on("pong", () => console.log("pong"));
  socket.on("connect_error", (e) => console.log("connect_error", e.message));

  socket.emit("ping");

  return socket;
}
