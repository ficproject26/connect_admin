/**
 * Rate Limiting Middleware for Banking-Grade Protection
 * Restricts sensitive auth endpoints (login, register, OTP) to 5 requests per minute per IP.
 */

const SecurityLog = require('../models/SecurityLog');

const memoryStore = new Map();

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (record.resetTime <= now) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute
  const max = options.max || 5; // 5 requests max
  const message = options.message || 'Too many requests from this IP, please try again after a minute.';

  return async (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.path}_${ip}`;
    const now = Date.now();

    let record = memoryStore.get(key);

    if (!record || record.resetTime <= now) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      memoryStore.set(key, record);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      // Log Rate Limit Exceeded security event
      try {
        await SecurityLog.create({
          eventType: 'RATE_LIMIT_EXCEEDED',
          ipAddress: ip.toString(),
          userAgent: req.headers['user-agent'] || 'Unknown',
          threatLevel: 'warning',
          details: `Rate limit of ${max} requests/min exceeded on route ${req.path}`
        });
      } catch (e) { }

      return res.status(429).json({
        status: 429,
        error: 'Too Many Requests',
        message,
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    next();
  };
};

const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Security Alert: Maximum 5 authentication requests per minute allowed. Please wait 60 seconds.'
});

const otpRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Security Alert: Maximum 3 OTP requests per minute allowed.'
});

const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many API requests from this IP address.'
});

module.exports = {
  authRateLimiter,
  otpRateLimiter,
  globalRateLimiter,
  createRateLimiter
};
