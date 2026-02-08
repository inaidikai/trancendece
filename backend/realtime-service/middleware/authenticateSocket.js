const jwt = require("jsonwebtoken");

module.exports = function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Missing token"));

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.userId ?? payload.id;
    if (!userId) return next(new Error("Invalid token payload"));

    socket.data.userId = userId;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
};
