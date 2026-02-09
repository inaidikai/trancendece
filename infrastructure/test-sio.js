const { io } = require("socket.io-client");

const token = process.env.TOKEN;

const socket = io("http://localhost:8081", {
  path: "/socket.io",
  transports: ["websocket"],     // force ws (optional)
  query: token ? { token } : {}, // if your middleware reads query.token
  // auth: token ? { token } : {}, // use this instead if middleware reads socket.handshake.auth.token
});

socket.on("connect", () => console.log("✅ CONNECTED", socket.id));
socket.on("connect_error", (e) => console.log("❌ CONNECT_ERROR", e.message));
socket.on("disconnect", (r) => console.log("🔴 DISCONNECTED", r));
