// Simple in-memory rate limiter for auth endpoints
const createRateLimiter = (maxRequests, windowMs) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!requests.has(key)) {
      requests.set(key, []);
    }

    const userRequests = requests.get(key);
    // Clean old requests outside the window
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);
    requests.set(key, recentRequests);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000),
      });
    }

    recentRequests.push(now);
    res.set('X-RateLimit-Limit', maxRequests);
    res.set('X-RateLimit-Remaining', maxRequests - recentRequests.length);
    next();
  };
};

// 5 requests per 15 minutes for registration
const registerLimiter = createRateLimiter(5, 15 * 60 * 1000);

// 10 login attempts per 15 minutes
const authLimiter = createRateLimiter(10, 15 * 60 * 1000);

// 5 password reset attempts per 30 minutes
const passwordResetLimiter = createRateLimiter(5, 30 * 60 * 1000);

module.exports = {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
};
