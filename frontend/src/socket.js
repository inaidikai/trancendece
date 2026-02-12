import { io } from "socket.io-client";
import { getToken } from "./auth/authApi";

export function makeSocket() {
  const socketBase =
    import.meta.env?.VITE_WS_URL || `${window.location.protocol}//${window.location.hostname}:8081`;

  return io(socketBase, {
    path: "/socket.io",
    // Start with polling then upgrade; this is more stable through WAF/proxy.
    transports: ["polling", "websocket"],
    tryAllTransports: true,
    auth: (cb) => cb({ token: getToken() }),
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });
}
