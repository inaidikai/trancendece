import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

// React env vars (CRA):
// REACT_APP_WS_URL=http://localhost:8081
// REACT_APP_WS_PATH=/socket.io
const WS_URL = process.env.REACT_APP_WS_URL || "http://localhost:8081";
const WS_PATH = process.env.REACT_APP_WS_PATH || "/socket.io";

/**
 * Custom hook to manage WebSocket connection
 */
export function useWebSocket(token) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  useEffect(() => {
    if (!token) {
      console.warn("⚠️ No token provided to useWebSocket");
      return;
    }

    // If a socket already exists, disconnect first (safe on token refresh)
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(WS_URL, {
      path: WS_PATH,

      // ✅ allow proxy/WAF fallback
      transports: ["websocket", "polling"],
      upgrade: true,

      auth: { token },

      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ WebSocket connected:", socket.id);
      setConnected(true);
      setReconnectAttempts(0);
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ WebSocket disconnected:", reason);
      setConnected(false);
    });

    // Socket.IO manager events (more reliable for attempts)
    socket.io.on("reconnect_attempt", (attempt) => {
      setReconnectAttempts(attempt);
      console.log("🔄 Reconnect attempt:", attempt);
    });

    socket.io.on("reconnect", (attemptNumber) => {
      console.log("🔄 Reconnected after", attemptNumber, "attempts");
      setConnected(true);
    });

    socket.io.on("reconnect_error", (error) => {
      console.error("❌ Reconnection failed:", error.message);
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Connect error:", error.message);
      setConnected(false);
    });

    // Heartbeat handler (only if your server really emits "heartbeat")
    socket.on("heartbeat", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });

    socket.on("error", ({ code, message }) => {
      console.error(`WS Error [${code}]: ${message}`);
    });

    return () => {
      console.log("🔌 Disconnecting WebSocket");
      socket.io.off("reconnect_attempt");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const emit = useCallback((event, payload) => {
    const s = socketRef.current;
    if (s && s.connected) {
      s.emit(event, payload);
      return true;
    }
    console.warn("⚠️ Cannot emit, socket not connected");
    return false;
  }, []);

  const on = useCallback((event, callback) => {
    const s = socketRef.current;
    if (s) s.on(event, callback);
  }, []);

  const off = useCallback((event, callback) => {
    const s = socketRef.current;
    if (s) s.off(event, callback);
  }, []);

  return {
    connected,
    reconnectAttempts,
    emit,
    on,
    off,
    socket: socketRef.current,
  };
}
