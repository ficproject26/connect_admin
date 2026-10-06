// DevSecOps Enterprise Security Middleware for Forge India Connect

const mongoSanitize = require('mongo-sanitize');
const AuditLog = require('../models/AuditLog');
const cacheService = require('../utils/cacheService');

// 1. HTTP SECURITY HEADERS MIDDLEWARE
const applySecurityHeaders = (req, res, next) => {
    // Remove X-Powered-By
    res.removeHeader('X-Powered-By');

    // OWASP & Enterprise HTTP Security Headers
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Enforce HSTS on production HTTPS
    if (process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
};

// 2. REDIS-BACKED RATE LIMITER WITH IN-MEMORY FALLBACK FOR AUTH ENDPOINTS (5 reqs/min)
const inMemoryRateLimitMap = new Map();

const authRateLimiter = (options = { windowMs: 60 * 1000, max: 5, message: 'Too many requests. Please try again after 1 minute.' }) => {
    return async (req, res, next) => {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
        const windowSeconds = Math.ceil(options.windowMs / 1000);

        try {
            // Priority 1: Multi-instance Redis Rate Limiting
            if (cacheService && cacheService.isRedisReady && cacheService.redisClient) {
                const redisKey = `ratelimit:auth:${clientIp}`;
                const count = await cacheService.redisClient.incr(redisKey);
                if (count === 1) {
                    await cacheService.redisClient.expire(redisKey, windowSeconds);
                }

                if (count > options.max) {
                    const ttl = await cacheService.redisClient.ttl(redisKey);
                    AuditLog.create({
                        userEmail: req.body?.email || '',
                        action: 'suspicious_activity',
                        ipAddress: clientIp,
                        userAgent: req.headers['user-agent'] || '',
                        status: 'blocked',
                        details: `Rate limit exceeded (${count} attempts) on ${req.originalUrl}`
                    }).catch(() => {});

                    return res.status(429).json({
                        error: 'Too Many Requests',
                        msg: options.message,
                        retryAfterSeconds: Math.max(1, ttl)
                    });
                }
                return next();
            }
        } catch (redisErr) {
            // Fail open to in-memory fallback if Redis has an intermittent error
            console.warn('[RateLimiter] Redis rate-limit fallback to memory:', redisErr.message);
        }

        // Priority 2: In-Memory Fallback
        const now = Date.now();
        if (!inMemoryRateLimitMap.has(clientIp)) {
            inMemoryRateLimitMap.set(clientIp, { count: 1, resetTime: now + options.windowMs });
            return next();
        }

        const ipData = inMemoryRateLimitMap.get(clientIp);
        if (now > ipData.resetTime) {
            inMemoryRateLimitMap.set(clientIp, { count: 1, resetTime: now + options.windowMs });
            return next();
        }

        ipData.count += 1;
        if (ipData.count > options.max) {
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
    // 1. Robust NoSQL Sanitization (strips all keys beginning with '$')
    if (req.body && typeof req.body === 'object') req.body = mongoSanitize(req.body);
    if (req.query && typeof req.query === 'object') req.query = mongoSanitize(req.query);
    if (req.params && typeof req.params === 'object') req.params = mongoSanitize(req.params);

    // 2. XSS string sanitization (removes script tags and inline event handlers)
    const sanitizeStrings = (val) => {
        if (typeof val === 'string') {
            let clean = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            clean = clean.replace(/on\w+\s*=/gi, '');
            return clean.trim();
        }
        if (typeof val === 'object' && val !== null) {
            for (const k of Object.keys(val)) {
                val[k] = sanitizeStrings(val[k]);
            }
        }
        return val;
    };

    if (req.body) req.body = sanitizeStrings(req.body);
    if (req.query) req.query = sanitizeStrings(req.query);
    if (req.params) req.params = sanitizeStrings(req.params);

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
