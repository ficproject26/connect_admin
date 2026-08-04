/**
 * Centralized Banking-Grade Security Input Validation Utility
 */

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
};

const validateIndianMobile = (phone) => {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return { isValid: false, message: 'Mobile number is required.' };
  }
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 0) {
    return { isValid: false, message: 'Mobile number is required.' };
  }
  if (!/^[6-9]/.test(clean)) {
    return { isValid: false, message: 'Mobile number must start with 6, 7, 8, or 9.' };
  }
  if (clean.length < 10) {
    return { isValid: false, message: 'Enter a valid 10-digit mobile number.' };
  }
  if (clean.length > 10) {
    return { isValid: false, message: 'Mobile number cannot exceed 10 digits.' };
  }
  if (!/^[6-9][0-9]{9}$/.test(clean)) {
    return { isValid: false, message: 'Enter a valid 10-digit mobile number.' };
  }
  return { isValid: true, message: '', cleanPhone: clean };
};

const validatePhone = (phone) => {
  return validateIndianMobile(phone).isValid;
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
  validateIndianMobile,
  validatePasswordPolicy,
  validatePAN,
  validateAadhaar,
  validatePincode,
  sanitizeInput
};
