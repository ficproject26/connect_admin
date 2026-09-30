const { maskEmail, generateSecureOtp, hashOtp, verifyOtpHash, OTP_EXPIRES_MINUTES } = require('../services/otpService');
const { sendOTPEmail, sendTestEmail } = require('../services/emailService');
const { getTransporter, verifyTransporter } = require('../config/mailer');

module.exports = {
  maskEmail,
  generateOtp: generateSecureOtp,
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  sendOTPEmail,
  sendPaymentSecurityEmail: sendOTPEmail,
  sendTestEmail,
  getTransporter,
  verifyTransporter,
  OTP_EXPIRES_MINUTES
};
