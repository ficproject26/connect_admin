const mongoose = require('mongoose');

const OTPVerificationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    otpHash: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        required: true,
        enum: [
            // Standard User-specified purposes
            'PAYMENT_AUTHORIZATION',
            'EMAIL_CHANGE_OLD',
            'EMAIL_CHANGE_NEW',
            'PIN_SETUP',
            'PIN_CHANGE',
            // Enterprise & payment compatibility purposes
            'PAYMENT_EMAIL_SETUP',
            'PAYMENT_EMAIL_CHANGE_OLD',
            'PAYMENT_EMAIL_CHANGE_NEW',
            'TRANSACTION_PIN_SETUP',
            'TRANSACTION_PIN_CHANGE'
        ],
        index: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    maxAttempts: {
        type: Number,
        default: 5
    },
    verified: {
        type: Boolean,
        default: false,
        index: true
    },
    isUsed: {
        type: Boolean,
        default: false,
        index: true
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.Mixed,
        index: true,
        default: null
    },
    adminId: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    resendCount: {
        type: Number,
        default: 0
    },
    lastResentAt: {
        type: Date,
        default: Date.now
    },
    sessionData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// TTL index to automatically remove expired OTP records after 24 hours
OTPVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

// Compound query index for fast lookups
OTPVerificationSchema.index({ email: 1, purpose: 1, verified: 1 });
OTPVerificationSchema.index({ email: 1, purpose: 1, isUsed: 1 });

module.exports = mongoose.model('OTPVerification', OTPVerificationSchema);
