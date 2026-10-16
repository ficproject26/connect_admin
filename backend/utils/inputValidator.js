/**
 * Connect App — Enterprise Global Form Validation & Normalization Utility
 * Backend CommonJS Module
 * 
 * Enforces unified validation standards across Customer, Vendor, Agent, Manager, 
 * Admin, Sub Admin, Registration, Onboarding, Profile, KYC, and Payment modules.
 */

// Bank-Specific Account Length Configurations (Known Indian Banks)
const BANK_ACCOUNT_LENGTHS = {
  sbi: { min: 11, max: 17, label: 'State Bank of India', allowed: [11, 17] },
  hdfc: { min: 14, max: 14, label: 'HDFC Bank', allowed: [14] },
  icici: { min: 12, max: 12, label: 'ICICI Bank', allowed: [12] },
  pnb: { min: 16, max: 16, label: 'Punjab National Bank', allowed: [16] },
  axis: { min: 15, max: 15, label: 'Axis Bank', allowed: [15] },
  canara: { min: 13, max: 13, label: 'Canara Bank', allowed: [13] },
  bob: { min: 14, max: 14, label: 'Bank of Baroda', allowed: [14] },
  union: { min: 15, max: 15, label: 'Union Bank of India', allowed: [15] },
  indian: { min: 9, max: 17, label: 'Indian Bank', allowed: [9, 10, 17] },
  kotak: { min: 10, max: 10, label: 'Kotak Mahindra Bank', allowed: [10] },
  indusind: { min: 12, max: 12, label: 'IndusInd Bank', allowed: [12] },
  yes: { min: 15, max: 15, label: 'Yes Bank', allowed: [15] },
  federal: { min: 14, max: 14, label: 'Federal Bank', allowed: [14] },
  central: { min: 10, max: 10, label: 'Central Bank of India', allowed: [10] }
};

const DEFAULT_BANK_ACCOUNT_MIN = 9;
const DEFAULT_BANK_ACCOUNT_MAX = 18;

// ==============================================================================
// 1. NAME FIELD VALIDATION & FORMATTING
// ==============================================================================

/**
 * Automatically capitalizes the first alphabetic character of each word.
 * Preserves spaces between words. Prevents leading spaces.
 * Example: "rathika" -> "Rathika", "rathika d" -> "Rathika D"
 */
const formatName = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmedLeading = value.replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
  return trimmedLeading.replace(/(?:^|\s|['.-])\p{L}/gu, (match) => match.toUpperCase());
};

const validateName = (name, fieldLabel = 'Name', isRequired = true) => {
  if (!name || typeof name !== 'string' || !name.trim()) {
    if (!isRequired) return { isValid: true, message: '', sanitizedValue: '' };
    return { isValid: false, message: `${fieldLabel} is required.`, sanitizedValue: '' };
  }

  const sanitized = formatName(name.trim());

  if (sanitized.length < 2) {
    return { isValid: false, message: `${fieldLabel} must be at least 2 characters long.`, sanitizedValue: sanitized };
  }

  if (sanitized.length > 70) {
    return { isValid: false, message: `${fieldLabel} cannot exceed 70 characters.`, sanitizedValue: sanitized };
  }

  const namePattern = /^[\p{L}][\p{L}\s.'-]{1,69}$/u;
  if (!namePattern.test(sanitized)) {
    return {
      isValid: false,
      message: `${fieldLabel} contains invalid characters. Only letters, spaces, hyphens, and periods are allowed.`,
      sanitizedValue: sanitized
    };
  }

  return { isValid: true, message: '', sanitizedValue: sanitized };
};

// ==============================================================================
// 2. EMAIL VALIDATION & NORMALIZATION
// ==============================================================================

const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

const validateEmail = (email, isRequired = true) => {
  if (!email || typeof email !== 'string' || !email.trim()) {
    if (!isRequired) return { isValid: true, message: '', normalizedEmail: '' };
    return { isValid: false, message: 'Email address is required.', normalizedEmail: '' };
  }

  const clean = email.trim();

  // Exactly one @ symbol required
  const atCount = (clean.match(/@/g) || []).length;
  if (atCount !== 1) {
    return { isValid: false, message: 'Email must contain exactly one "@" symbol.', normalizedEmail: clean.toLowerCase() };
  }

  if (/\s/.test(clean)) {
    return { isValid: false, message: 'Email address cannot contain spaces.', normalizedEmail: clean.toLowerCase() };
  }

  // Standard email structure: localpart@domain.extension
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) {
    return { isValid: false, message: 'Please enter a valid email address (e.g. name@domain.com).', normalizedEmail: clean.toLowerCase() };
  }

  return { isValid: true, message: '', normalizedEmail: clean.toLowerCase() };
};

// ==============================================================================
// 3. INDIAN MOBILE NUMBER VALIDATION
// ==============================================================================

const cleanIndianMobile = (phone) => {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
};

const validateIndianMobile = (phone, isRequired = true, fieldLabel = 'Mobile number') => {
  if (!phone || (typeof phone === 'string' && !phone.trim())) {
    if (!isRequired) return { isValid: true, message: '', cleanPhone: '' };
    return { isValid: false, message: `${fieldLabel} is required.`, cleanPhone: '' };
  }

  const rawStr = String(phone).trim();
  if (/[^\d+\s-]/.test(rawStr)) {
    return { isValid: false, message: `${fieldLabel} must contain numbers only.`, cleanPhone: '' };
  }

  const clean = cleanIndianMobile(rawStr);

  if (clean.length === 0) {
    if (!isRequired) return { isValid: true, message: '', cleanPhone: '' };
    return { isValid: false, message: `${fieldLabel} is required.`, cleanPhone: '' };
  }

  if (clean.length !== 10) {
    return {
      isValid: false,
      message: `${fieldLabel} must be exactly 10 digits (currently ${clean.length} digits).`,
      cleanPhone: clean
    };
  }

  if (!/^[6-9]/.test(clean)) {
    return {
      isValid: false,
      message: `${fieldLabel} must start with 6, 7, 8, or 9 (numbers starting with 0–5 are not valid).`,
      cleanPhone: clean
    };
  }

  if (!/^[6-9][0-9]{9}$/.test(clean)) {
    return {
      isValid: false,
      message: `Please enter a valid 10-digit Indian ${fieldLabel.toLowerCase()}.`,
      cleanPhone: clean
    };
  }

  return { isValid: true, message: '', cleanPhone: clean };
};

const validatePhone = (phone) => {
  return validateIndianMobile(phone).isValid;
};

// ==============================================================================
// 4. PASSWORD POLICY & CONFIRMATION VALIDATION
// ==============================================================================

/**
 * Requirements:
 * - Minimum 6 characters
 * - At least one uppercase letter (A-Z)
 * - At least one numeric digit (0-9)
 * - At least one special character (!@#$%^&* etc.)
 * Pattern: ^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).{6,}$
 */
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).{6,}$/;

const validatePasswordPolicy = (password, isRequired = true) => {
  if (!password || typeof password !== 'string') {
    if (!isRequired) return { isValid: true, valid: true, message: '', reason: '', msg: '' };
    return { isValid: false, valid: false, message: 'Password is required.', reason: 'Password is required.', msg: 'Password is required.' };
  }

  if (password.length < 6) {
    const msg = 'Password must be at least 6 characters long.';
    return { isValid: false, valid: false, message: msg, reason: msg, msg };
  }

  if (!/[A-Z]/.test(password)) {
    const msg = 'Password must contain at least one uppercase letter (A–Z).';
    return { isValid: false, valid: false, message: msg, reason: msg, msg };
  }

  if (!/[0-9]/.test(password)) {
    const msg = 'Password must contain at least one numeric digit (0–9).';
    return { isValid: false, valid: false, message: msg, reason: msg, msg };
  }

  if (!/[^A-Za-z0-9\s]/.test(password)) {
    const msg = 'Password must contain at least one special character (e.g. @, #, $, !).';
    return { isValid: false, valid: false, message: msg, reason: msg, msg };
  }

  return { isValid: true, valid: true, message: '', reason: '', msg: '' };
};

const validatePasswordMatch = (password, confirmPassword) => {
  if (!password && !confirmPassword) return { isValid: true, message: '' };
  if (password !== confirmPassword) {
    return { isValid: false, message: 'Password and Confirm Password do not match.' };
  }
  return { isValid: true, message: '' };
};

// ==============================================================================
// 5. AADHAAR NUMBER VALIDATION & MASKING
// ==============================================================================

const cleanAadhaar = (aadhaar) => {
  if (!aadhaar) return '';
  return String(aadhaar).replace(/\D/g, '');
};

const maskAadhaar = (aadhaar) => {
  const clean = cleanAadhaar(aadhaar);
  if (!clean || clean.length < 4) return clean || '—';
  return `••••••••${clean.slice(-4)}`;
};

const validateAadhaar = (aadhaar, isRequired = true) => {
  if (!aadhaar || (typeof aadhaar === 'string' && !aadhaar.trim())) {
    if (!isRequired) return { isValid: true, message: '', cleanAadhaar: '', maskedAadhaar: '' };
    return { isValid: false, message: 'Aadhaar number is required.', cleanAadhaar: '', maskedAadhaar: '' };
  }

  const rawStr = String(aadhaar).trim();
  if (/[^\d\s-]/.test(rawStr)) {
    return { isValid: false, message: 'Aadhaar number must contain numeric digits only.', cleanAadhaar: '', maskedAadhaar: '' };
  }

  const clean = cleanAadhaar(rawStr);

  if (clean.length !== 12) {
    return {
      isValid: false,
      message: `Aadhaar number must be exactly 12 numeric digits (currently ${clean.length} digits).`,
      cleanAadhaar: clean,
      maskedAadhaar: maskAadhaar(clean)
    };
  }

  if (!/^[0-9]{12}$/.test(clean)) {
    return { isValid: false, message: 'Enter a valid 12-digit Aadhaar number.', cleanAadhaar: clean, maskedAadhaar: maskAadhaar(clean) };
  }

  return { isValid: true, message: '', cleanAadhaar: clean, maskedAadhaar: maskAadhaar(clean) };
};

// ==============================================================================
// 6. PAN CARD VALIDATION
// ==============================================================================

const cleanPAN = (pan) => {
  if (!pan) return '';
  return String(pan).toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const validatePAN = (pan, isRequired = true) => {
  if (!pan || (typeof pan === 'string' && !pan.trim())) {
    if (!isRequired) return { isValid: true, message: '', cleanPAN: '' };
    return { isValid: false, message: 'PAN card number is required.', cleanPAN: '' };
  }

  const clean = cleanPAN(pan);

  if (clean.length !== 10) {
    return {
      isValid: false,
      message: `PAN must be exactly 10 characters (currently ${clean.length} characters). Format: ABCDE1234F`,
      cleanPAN: clean
    };
  }

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panRegex.test(clean)) {
    return {
      isValid: false,
      message: 'Invalid PAN format. Must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F).',
      cleanPAN: clean
    };
  }

  return { isValid: true, message: '', cleanPAN: clean };
};

// ==============================================================================
// 7. BANK ACCOUNT NUMBER VALIDATION & MASKING
// ==============================================================================

const cleanBankAccount = (account) => {
  if (!account) return '';
  return String(account).replace(/\D/g, '');
};

const maskBankAccount = (account) => {
  const clean = cleanBankAccount(account);
  if (!clean || clean.length < 4) return clean || '—';
  return `••••••••${clean.slice(-4)}`;
};

const validateBankAccount = (account, bankName = '', isRequired = true) => {
  if (!account || (typeof account === 'string' && !account.trim())) {
    if (!isRequired) return { isValid: true, message: '', cleanAccount: '', maskedAccount: '' };
    return { isValid: false, message: 'Bank account number is required.', cleanAccount: '', maskedAccount: '' };
  }

  const rawStr = String(account).trim();
  if (/\D/.test(rawStr)) {
    return { isValid: false, message: 'Account number must contain numeric digits only.', cleanAccount: '', maskedAccount: '' };
  }

  const clean = cleanBankAccount(rawStr);

  if (bankName && typeof bankName === 'string') {
    const bKey = bankName.toLowerCase().replace(/[^a-z]/g, '');
    let matchedBank = null;
    for (const [key, config] of Object.entries(BANK_ACCOUNT_LENGTHS)) {
      if (bKey.includes(key) || config.label.toLowerCase().replace(/[^a-z]/g, '').includes(bKey)) {
        matchedBank = config;
        break;
      }
    }

    if (matchedBank) {
      if (matchedBank.allowed && !matchedBank.allowed.includes(clean.length)) {
        return {
          isValid: false,
          message: `${matchedBank.label} account numbers must be ${matchedBank.allowed.join(' or ')} digits (currently ${clean.length} digits).`,
          cleanAccount: clean,
          maskedAccount: maskBankAccount(clean)
        };
      }
      if (clean.length < matchedBank.min || clean.length > matchedBank.max) {
        return {
          isValid: false,
          message: `${matchedBank.label} account numbers must be between ${matchedBank.min} and ${matchedBank.max} digits.`,
          cleanAccount: clean,
          maskedAccount: maskBankAccount(clean)
        };
      }
    }
  }

  if (clean.length < DEFAULT_BANK_ACCOUNT_MIN || clean.length > DEFAULT_BANK_ACCOUNT_MAX) {
    return {
      isValid: false,
      message: `Bank account number must be between ${DEFAULT_BANK_ACCOUNT_MIN} and ${DEFAULT_BANK_ACCOUNT_MAX} digits (currently ${clean.length} digits).`,
      cleanAccount: clean,
      maskedAccount: maskBankAccount(clean)
    };
  }

  return { isValid: true, message: '', cleanAccount: clean, maskedAccount: maskBankAccount(clean) };
};

const validateBankAccountMatch = (account, confirmAccount) => {
  const cleanA = cleanBankAccount(account);
  const cleanC = cleanBankAccount(confirmAccount);
  if (!cleanA && !cleanC) return { isValid: true, message: '' };
  if (cleanA !== cleanC) {
    return { isValid: false, message: 'Bank account number and Confirm account number do not match.' };
  }
  return { isValid: true, message: '' };
};

// ==============================================================================
// 8. IFSC CODE VALIDATION
// ==============================================================================

const cleanIFSC = (ifsc) => {
  if (!ifsc) return '';
  return String(ifsc).toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const validateIFSC = (ifsc, isRequired = true) => {
  if (!ifsc || (typeof ifsc === 'string' && !ifsc.trim())) {
    if (!isRequired) return { isValid: true, message: '', cleanIFSC: '' };
    return { isValid: false, message: 'IFSC code is required.', cleanIFSC: '' };
  }

  const clean = cleanIFSC(ifsc);

  if (clean.length !== 11) {
    return {
      isValid: false,
      message: `IFSC code must be exactly 11 characters (currently ${clean.length} characters). Example: SBIN0001234`,
      cleanIFSC: clean
    };
  }

  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(clean)) {
    if (clean[4] !== '0') {
      return {
        isValid: false,
        message: 'Invalid IFSC code: the 5th character must be "0" (zero). Example: SBIN0001234',
        cleanIFSC: clean
      };
    }
    return {
      isValid: false,
      message: 'Invalid IFSC code format. Must be 4 letters, followed by 0, followed by 6 alphanumeric characters (e.g. SBIN0001234).',
      cleanIFSC: clean
    };
  }

  return { isValid: true, message: '', cleanIFSC: clean };
};

// ==============================================================================
// 9. DATE OF BIRTH & MINIMUM AGE VALIDATION (18+ YEARS)
// ==============================================================================

const calculateAge = (dob) => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

const validateDOB = (dob, minAge = 18, isRequired = true) => {
  if (!dob || (typeof dob === 'string' && !dob.trim())) {
    if (!isRequired) return { isValid: true, message: '', age: null };
    return { isValid: false, message: 'Date of birth is required.', age: null };
  }

  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) {
    return { isValid: false, message: 'Please enter a valid date of birth.', age: null };
  }

  const today = new Date();
  if (birthDate > today) {
    return { isValid: false, message: 'Date of birth cannot be in the future.', age: null };
  }

  if (today.getFullYear() - birthDate.getFullYear() > 120) {
    return { isValid: false, message: 'Please enter a realistic date of birth.', age: null };
  }

  const age = calculateAge(dob);

  if (age === null || age < minAge) {
    return {
      isValid: false,
      message: `You must be at least ${minAge} years old to register.`,
      age
    };
  }

  return { isValid: true, message: '', age };
};

// ==============================================================================
// 10. PINCODE VALIDATION & SANITIZATION
// ==============================================================================

const validatePincode = (pincode, isRequired = true) => {
  if (!pincode || (typeof pincode === 'string' && !pincode.trim())) {
    if (!isRequired) return { isValid: true, message: '', cleanPincode: '' };
    return { isValid: false, message: 'Pincode is required.', cleanPincode: '' };
  }
  const clean = String(pincode).trim().replace(/\D/g, '');
  if (!/^\d{6}$/.test(clean)) {
    return { isValid: false, message: 'Pincode must be exactly 6 numeric digits.', cleanPincode: clean };
  }
  return { isValid: true, message: '', cleanPincode: clean };
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
  BANK_ACCOUNT_LENGTHS,
  DEFAULT_BANK_ACCOUNT_MIN,
  DEFAULT_BANK_ACCOUNT_MAX,
  PASSWORD_REGEX,
  formatName,
  validateName,
  normalizeEmail,
  validateEmail,
  cleanIndianMobile,
  validateIndianMobile,
  validatePhone,
  validatePasswordPolicy,
  validatePasswordMatch,
  cleanAadhaar,
  maskAadhaar,
  validateAadhaar,
  cleanPAN,
  validatePAN,
  cleanBankAccount,
  maskBankAccount,
  validateBankAccount,
  validateBankAccountMatch,
  cleanIFSC,
  validateIFSC,
  calculateAge,
  validateDOB,
  validatePincode,
  sanitizeInput
};
