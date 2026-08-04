/**
 * Enterprise Cyber Attack Protection Middleware (OWASP Top 10)
 */

const { sanitizeInput } = require('../utils/inputValidator');

const securityHeaders = (req, res, next) => {
  // Prevent clickjacking by forbidding iframe framing
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable browser XSS filtering
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information sent in headers
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Enforce HTTP Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Basic Content Security Policy (CSP)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https: wss:;"
  );

  next();
};

// Anti NoSQL Injection & Reflected XSS Sanitization Middleware
const antiInjectionSanitizer = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }
  next();
};

module.exports = {
  securityHeaders,
  antiInjectionSanitizer
};
