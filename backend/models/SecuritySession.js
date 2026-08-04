const mongoose = require('mongoose');

const SecuritySessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    refreshTokenHash: { type: String, default: '' },
    deviceInfo: {
        deviceName: { type: String, default: 'Web Browser' },
        browser: { type: String, default: 'Unknown Browser' },
        os: { type: String, default: 'Unknown OS' },
        deviceType: { type: String, default: 'Desktop' }
    },
    ipAddress: { type: String, default: '127.0.0.1' },
    location: {
        city: { type: String, default: 'Local' },
        country: { type: String, default: 'India' }
    },
    isActive: { type: Boolean, default: true },
    lastActive: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

SecuritySessionSchema.index({ userId: 1, isActive: 1 });
SecuritySessionSchema.index({ tokenHash: 1 });

module.exports = mongoose.model('SecuritySession', SecuritySessionSchema);
