const rateLimit = require('express-rate-limit');

const keyGenerator = (req) => req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';

const createRateLimiter = (maxRequests, windowMs) =>
  rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res, _next, options) => {
      const resetTime = req.rateLimit?.resetTime;
      const retryAfter = resetTime ? Math.ceil((resetTime.getTime() - Date.now()) / 1000) : undefined;
      return res.status(options.statusCode).json({
        error: 'Too many requests. Please try again later.',
        ...(retryAfter ? { retryAfter } : {}),
      });
    },
  });

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
