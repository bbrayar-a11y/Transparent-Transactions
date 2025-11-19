// config/rate-limiting.js
const rateLimit = require('express-rate-limit');

// Different rate limiting configurations for different types of endpoints
const rateLimits = {
  // Strict limits for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 auth requests per windowMs
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again after 15 minutes',
      security: 'rate_limited'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
  }),

  // General API limits
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again after 15 minutes',
      security: 'rate_limited'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Strict limits for sensitive operations (transactions, etc.)
  sensitive: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 sensitive operations per windowMs
    message: {
      success: false,
      message: 'Too many sensitive operations, please try again after 15 minutes',
      security: 'rate_limited'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Very strict limits for password reset, etc.
  critical: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 critical requests per hour
    message: {
      success: false,
      message: 'Too many critical operations, please try again after 1 hour',
      security: 'rate_limited'
    },
    standardHeaders: true,
    legacyHeaders: false,
  })
};

// Helper function to create custom rate limits
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      security: 'rate_limited'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Rate limit key generator (can be customized for user-based limiting)
const keyGenerator = (req) => {
  return req.ip; // Use IP address by default
};

// Skip function for certain conditions (optional)
const skipRateLimit = (req) => {
  // Skip rate limiting for health checks
  if (req.path === '/api/health' || req.path === '/api/security/health') {
    return true;
  }
  
  // Skip for certain IPs if needed (development, etc.)
  const allowedIPs = ['::1', '127.0.0.1', 'localhost'];
  if (allowedIPs.includes(req.ip)) {
    return true;
  }
  
  return false;
};

module.exports = {
  rateLimits,
  createRateLimit,
  keyGenerator,
  skipRateLimit
};