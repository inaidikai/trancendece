import { io } from "socket.io-client";

export function makeSocket() {
  const token = localStorage.getItem("token");

  return io("http://localhost:8081", {
    path: "/socket.io",
    transports: ["websocket", "polling"], // allow fallback
    auth: { token }, // your authenticateSocket reads this
    withCredentials: true,
  });
}
