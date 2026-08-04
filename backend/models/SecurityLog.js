const mongoose = require('mongoose');

const SecurityLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'SUCCESSFUL_LOGIN',
      'FAILED_LOGIN',
      'ACCOUNT_TEMP_LOCKED',
      'ACCOUNT_PERM_LOCKED',
      'ACCOUNT_UNLOCKED',
      'PASSWORD_CHANGED',
      'OTP_VERIFICATION',
      'OTP_FAILED',
      'DEVICE_ADDED',
      'SESSION_REVOKED',
      'SUSPICIOUS_IP',
      'RATE_LIMIT_EXCEEDED',
      'UNAUTHORIZED_ACCESS_ATTEMPT'
    ]
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  email: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: 'Unknown'
  },
  browser: {
    type: String,
    default: 'Unknown'
  },
  os: {
    type: String,
    default: 'Unknown'
  },
  city: {
    type: String,
    default: 'Unknown'
  },
  country: {
    type: String,
    default: 'India'
  },
  threatLevel: {
    type: String,
    enum: ['info', 'warning', 'danger', 'critical'],
    default: 'info'
  },
  details: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

SecurityLogSchema.index({ timestamp: -1 });
SecurityLogSchema.index({ eventType: 1 });
SecurityLogSchema.index({ ipAddress: 1 });
SecurityLogSchema.index({ userId: 1 });

module.exports = mongoose.model('SecurityLog', SecurityLogSchema);
