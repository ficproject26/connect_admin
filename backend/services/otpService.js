const crypto = require('crypto');

const PEPPER_SECRET = process.env.JWT_SECRET || 'connect_secret_key_prod_2026';
const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 5;

/**
 * Mask email for safe UI display (e.g. "admin@example.com" -> "a******@example.com")
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  const clean = email.trim();
  const parts = clean.split('@');
  if (parts.length !== 2) return clean;
  const [user, domain] = parts;
  if (user.length <= 1) {
    return `${user}******@${domain}`;
  }
  const visibleStart = user.slice(0, 1);
  return `${visibleStart}******@${domain}`;
};

/**
 * Generate cryptographically secure 6-digit numeric OTP
 * Using Node.js crypto.randomInt (100000 to 1000000)
 */
const generateSecureOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Hash OTP with email, purpose, and server pepper (SHA-256)
 */
const hashOtp = (otp, email, purpose) => {
  const raw = `${String(otp).trim()}:${String(email).toLowerCase().trim()}:${String(purpose).trim()}:${PEPPER_SECRET}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
};

/**
 * Verify submitted OTP against stored hash using timing-safe comparison
 */
const verifyOtpHash = (enteredOtp, email, purpose, storedHash) => {
  if (!enteredOtp || !storedHash) return false;
  const computed = hashOtp(enteredOtp, email, purpose);
  const bufA = Buffer.from(computed, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

module.exports = {
  maskEmail,
  generateSecureOtp,
  generateOtp: generateSecureOtp, // Alias
  hashOtp,
  verifyOtpHash,
  OTP_EXPIRES_MINUTES
};
