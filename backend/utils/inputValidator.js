/**
 * Centralized Banking-Grade Security Input Validation Utility
 */

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
};

const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length === 10 && /^[6-9]\d{9}$/.test(cleanPhone);
};

const validatePasswordPolicy = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, reason: 'Password must be provided' };
  }
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long' };
  }
  if (password.length > 32) {
    return { valid: false, reason: 'Password cannot exceed 32 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one special character' };
  }
  return { valid: true };
};

const validatePAN = (pan) => {
  if (!pan || typeof pan !== 'string') return false;
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim().toUpperCase());
};

const validateAadhaar = (aadhaar) => {
  if (!aadhaar || typeof aadhaar !== 'string') return false;
  const cleanAadhaar = aadhaar.replace(/\s/g, '');
  return /^\d{12}$/.test(cleanAadhaar);
};

const validatePincode = (pincode) => {
  if (!pincode || typeof pincode !== 'string') return false;
  return /^\d{6}$/.test(pincode.trim());
};

const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[\$]/g, '')
      .trim();
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const key of Object.keys(input)) {
      if (!key.startsWith('$')) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  return input;
};

module.exports = {
  validateEmail,
  validatePhone,
  validatePasswordPolicy,
  validatePAN,
  validateAadhaar,
  validatePincode,
  sanitizeInput
};
