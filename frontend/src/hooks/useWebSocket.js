import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const WS_URL = process.env.REACT_APP_WS_URL || "http://localhost:4000";

/**
 * Custom hook to manage WebSocket connection
 */
export function useWebSocket(token) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Initialize connection
  useEffect(() => {
    if (!token) {
      console.warn("⚠️ No token provided to useWebSocket");
      return;
    }

    const socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection established
    socket.on("connect", () => {
      console.log("✅ WebSocket connected:", socket.id);
      setConnected(true);
    });

    // Connection lost
    socket.on("disconnect", (reason) => {
      console.log("⚠️ WebSocket disconnected:", reason);
      setConnected(false);
    });

    // Reconnection events
    socket.on("reconnect", (attemptNumber) => {
      console.log("🔄 Reconnected after", attemptNumber, "attempts");
      setConnected(true);
    });

    socket.on("reconnect_error", (error) => {
      console.error("❌ Reconnection failed:", error.message);
    });

    // Heartbeat handler
    socket.on("heartbeat", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });

    // Error handler
    socket.on("error", ({ code, message }) => {
      console.error(`WS Error [${code}]: ${message}`);
    });

    // Cleanup on unmount
    return () => {
      console.log("🔌 Disconnecting WebSocket");
      socket.disconnect();
    };
  }, [token]);

  // Emit wrapper function
  const emit = useCallback((event, payload) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, payload);
    } else {
      console.warn("⚠️ Cannot emit, socket not connected");
    }
  }, []);

  // Listen for events
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  // Remove event listeners
  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  return { 
    connected, 
    emit, 
    on, 
    off, 
    socket: socketRef.current 
  };
}
