// DevSecOps Enterprise Security Middleware for Forge India Connect

const AuditLog = require('../models/AuditLog');

// 1. HELMET SECURITY HEADERS MIDDLEWARE
const applySecurityHeaders = (req, res, next) => {
    // OWASP & Banking level HTTP Security Headers
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // Allow framed embedding if needed, protect clickjacking
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
};

// 2. IN-MEMORY RATE LIMITER FOR AUTH ENDPOINTS (5 reqs/min)
const rateLimitMap = new Map();

const authRateLimiter = (options = { windowMs: 60 * 1000, max: 5, message: 'Too many login/OTP requests from this IP. Please try again after 1 minute.' }) => {
    return (req, res, next) => {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const now = Date.now();
        
        if (!rateLimitMap.has(clientIp)) {
            rateLimitMap.set(clientIp, { count: 1, resetTime: now + options.windowMs });
            return next();
        }

        const ipData = rateLimitMap.get(clientIp);

        if (now > ipData.resetTime) {
            rateLimitMap.set(clientIp, { count: 1, resetTime: now + options.windowMs });
            return next();
        }

        ipData.count += 1;

        if (ipData.count > options.max) {
            // Log security warning for rate limit violation
            AuditLog.create({
                userEmail: req.body?.email || '',
                action: 'suspicious_activity',
                ipAddress: clientIp,
                userAgent: req.headers['user-agent'] || '',
                status: 'blocked',
                details: `Rate limit exceeded (${ipData.count} attempts) on ${req.originalUrl}`
            }).catch(() => {});

            return res.status(429).json({
                error: 'Too Many Requests',
                msg: options.message,
                retryAfterSeconds: Math.ceil((ipData.resetTime - now) / 1000)
            });
        }

        next();
    };
};

// 3. CYBER ATTACK PREVENTION & INPUT SANITIZATION
const sanitizeInput = (req, res, next) => {
    const sanitizeValue = (val) => {
        if (typeof val === 'string') {
            // NoSQL injection stripping ($gt, $ne, etc.)
            let clean = val.replace(/\$gt|\$ne|\$where|\$regex|\$or|\$and|\$exec/gi, '');
            // XSS script tag stripping
            clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            clean = clean.replace(/on\w+\s*=/gi, '');
            // SQL keywords
            clean = clean.replace(/\b(UNION|SELECT|INSERT|DELETE|DROP|ALTER)\b/gi, '');
            return clean.trim();
        }
        if (typeof val === 'object' && val !== null) {
            for (const k of Object.keys(val)) {
                if (k.startsWith('$')) {
                    delete val[k];
                } else {
                    val[k] = sanitizeValue(val[k]);
                }
            }
        }
        return val;
    };

    if (req.body) req.body = sanitizeValue(req.body);
    if (req.query) req.query = sanitizeValue(req.query);
    if (req.params) req.params = sanitizeValue(req.params);

    next();
};

// 4. USER-AGENT & DEVICE PARSER HELPER
const parseDeviceInfo = (userAgentString = '') => {
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';
    let deviceType = 'Desktop';

    if (/mobile/i.test(userAgentString)) deviceType = 'Mobile';
    if (/tablet|ipad/i.test(userAgentString)) deviceType = 'Tablet';

    if (/chrome|crios/i.test(userAgentString)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(userAgentString)) browser = 'Firefox';
    else if (/safari/i.test(userAgentString)) browser = 'Safari';
    else if (/edg/i.test(userAgentString)) browser = 'Edge';

    if (/windows/i.test(userAgentString)) os = 'Windows';
    else if (/macintosh|mac os/i.test(userAgentString)) os = 'macOS';
    else if (/android/i.test(userAgentString)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(userAgentString)) os = 'iOS';
    else if (/linux/i.test(userAgentString)) os = 'Linux';

    return { browser, os, deviceType, deviceName: `${os} (${browser})` };
};

module.exports = {
    applySecurityHeaders,
    authRateLimiter,
    sanitizeInput,
    parseDeviceInfo
};
