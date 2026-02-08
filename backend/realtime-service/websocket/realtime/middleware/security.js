const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

// Security middleware stack
const securityMiddleware = [
  // Helmet helps secure Express apps by setting various HTTP headers
  helmet(),
  
  // Data sanitization against NoSQL injection
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      console.log(`Sanitized field: ${key}`);
    },
  }),

  // Custom middleware for additional security
  (req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection in older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    
    // Prevent referrer leaking
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Remove powered-by header
    res.removeHeader('X-Powered-By');
    
    next();
  },
];

module.exports = securityMiddleware;
