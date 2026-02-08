const db = require('../config/database');
const { generateId } = require('../utils/auth');

// Get client IP address
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || req.socket.remoteAddress;
};

// Log action to database
const logAction = (req, userId, action, details = {}, status = 'success') => {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';

  const query = `
    INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
  `;

  const logId = generateId();
  const detailsJson = JSON.stringify(details);

  db.run(query, [logId, userId || null, action, detailsJson, ip, userAgent, status], (err) => {
    if (err) {
      console.error('Error logging action:', err);
    }
  });
};

// Middleware to log actions
const auditMiddleware = (action, detailsExtractor = null) => {
  return (req, res, next) => {
    // Intercept response to log after response is sent
    const originalJson = res.json;
    const originalSend = res.send;

    const userId = req.user?.userId || null;
    const details = detailsExtractor ? detailsExtractor(req, res) : {};

    res.json = function (data) {
      const status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure';
      logAction(req, userId, action, details, status);
      return originalJson.call(this, data);
    };

    res.send = function (data) {
      const status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure';
      logAction(req, userId, action, details, status);
      return originalSend.call(this, data);
    };

    next();
  };
};

// Get user's audit logs
const getUserLogs = (req, res) => {
  const userId = req.user.userId;
  const { limit = 50, offset = 0 } = req.query;

  const query = `
    SELECT id, action, details, ip_address, status, created_at
    FROM audit_logs
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  db.all(query, [userId, parseInt(limit), parseInt(offset)], (err, logs) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Parse JSON details
    const parsedLogs = logs.map((log) => ({
      ...log,
      details: JSON.parse(log.details || '{}'),
    }));

    res.json(parsedLogs);
  });
};

module.exports = {
  logAction,
  auditMiddleware,
  getUserLogs,
  getClientIP,
};
