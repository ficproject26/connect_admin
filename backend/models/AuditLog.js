const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userEmail: { type: String, default: '' },
    userRole: { type: String, default: 'guest' },
    action: {
        type: String,
        required: true,
        enum: [
            'login_success',
            'login_failed',
            'password_change',
            'otp_sent',
            'otp_verify',
            'account_locked',
            'account_unlocked',
            'device_login',
            'session_terminated',
            'logout_all',
            'suspicious_activity',
            'ip_blocked',
            'vendor_status_changed',
            'vendor_deactivated',
            'vendor_activated',
            'vendor_suspended'
        ]
    },
    ipAddress: { type: String, default: '127.0.0.1' },
    userAgent: { type: String, default: '' },
    deviceInfo: {
        browser: { type: String, default: 'Unknown Browser' },
        os: { type: String, default: 'Unknown OS' },
        deviceType: { type: String, default: 'Desktop' }
    },
    location: {
        city: { type: String, default: 'Local' },
        country: { type: String, default: 'India' }
    },
    status: { type: String, enum: ['success', 'warning', 'failed', 'blocked'], default: 'success' },
    details: { type: String, default: '' },
    metadata: { type: Object, default: {} },
    timestamp: { type: Date, default: Date.now }
});

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
