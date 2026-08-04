const mongoose = require('mongoose');

const UserSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true,
    unique: true
  },
  deviceName: {
    type: String,
    default: 'Desktop / Mobile Web'
  },
  browser: {
    type: String,
    default: 'Chrome / Safari'
  },
  os: {
    type: String,
    default: 'Windows / Android / iOS'
  },
  ipAddress: {
    type: String,
    required: true
  },
  city: {
    type: String,
    default: 'India'
  },
  country: {
    type: String,
    default: 'India'
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  }
});

UserSessionSchema.index({ userId: 1, isRevoked: 1 });
UserSessionSchema.index({ refreshToken: 1 });
UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UserSession', UserSessionSchema);
