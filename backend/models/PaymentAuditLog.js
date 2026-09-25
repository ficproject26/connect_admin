const mongoose = require('mongoose');

const PaymentAuditLogSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        default: '',
        index: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            'payment_created',
            'payment_viewed',
            'payment_assigned',
            'otp_requested',
            'otp_verified',
            'otp_failed',
            'pin_setup',
            'pin_verified',
            'pin_failed',
            'payment_confirmed',
            'payment_processed',
            'payment_failed',
            'payment_cancelled',
            'payment_delegated',
            'payment_reassigned'
        ],
        index: true
    },
    user: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    role: {
        type: String,
        default: 'super-admin'
    },
    details: {
        type: String,
        default: ''
    },
    metadata: {
        type: Object,
        default: {}
    },
    ipAddress: {
        type: String,
        default: '127.0.0.1'
    },
    userAgent: {
        type: String,
        default: ''
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

PaymentAuditLogSchema.index({ timestamp: -1 });
PaymentAuditLogSchema.index({ paymentId: 1, action: 1 });

module.exports = mongoose.model('PaymentAuditLog', PaymentAuditLogSchema);
