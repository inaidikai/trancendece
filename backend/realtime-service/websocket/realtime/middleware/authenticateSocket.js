// Socket.IO authentication middleware
const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/auth");

/**
 * Socket.IO authentication middleware
 * Extracts and verifies JWT token from socket handshake
 * @param {Socket} socket 
 * @param {Function} next 
 */
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    
    if (!token) {
      return next(new Error("Authentication error: Token not provided"));
    }

    // Use existing verifyToken from your utils
    const payload = verifyToken(token);
    
    if (!payload) {
      return next(new Error("Authentication error: Invalid or expired token"));
    }

    // Store userId in socket data for use in handlers
    socket.data.userId = payload.userId;

    return next();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Socket auth failed:`, err.message);
    return next(new Error("Authentication error: Invalid token"));
  }
};

module.exports = authenticateSocket;
