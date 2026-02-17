import { io } from "socket.io-client";
import { getToken } from "./auth/authApi";

export function makeSocket() {
  const explicitWsUrl = String(import.meta.env?.VITE_WS_URL || "").trim();
  const socketBase = explicitWsUrl || window.location.origin;
  const forceWsUpgrade = String(import.meta.env?.VITE_SOCKET_FORCE_WEBSOCKET || "")
    .trim()
    .toLowerCase() === "true";
  const isViteLocalDev =
    typeof window !== "undefined" && String(window.location.port) === "5173";

  // Local HTTPS dev + proxy can reject websocket upgrade; polling remains realtime and stable.
  const transports =
    isViteLocalDev && !forceWsUpgrade ? ["polling"] : ["polling", "websocket"];
  const shouldUpgrade = transports.includes("websocket");

  return io(socketBase, {
    path: "/socket.io",
    transports,
    upgrade: shouldUpgrade,
    tryAllTransports: shouldUpgrade,
    auth: (cb) => cb({ token: getToken() }),
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });
}
