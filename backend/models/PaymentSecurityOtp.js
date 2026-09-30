const mongoose = require('mongoose');

const PaymentSecurityOtpSchema = new mongoose.Schema({
    purpose: {
        type: String,
        required: true,
        enum: [
            'PAYMENT_EMAIL_SETUP',
            'PAYMENT_EMAIL_CHANGE_OLD',
            'PAYMENT_EMAIL_CHANGE_NEW',
            'CURRENT_EMAIL_CHANGE',
            'NEW_EMAIL_CHANGE',
            'TRANSACTION_PIN_SETUP',
            'TRANSACTION_PIN_CHANGE',
            'PAYMENT_AUTHORIZATION'
        ],
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.Mixed,
        index: true
    },
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
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    maxAttempts: {
        type: Number,
        default: 3
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
    sessionData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    resendCount: {
        type: Number,
        default: 0
    },
    lastResentAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 1800 // TTL: 30 minutes in MongoDB
    }
});

PaymentSecurityOtpSchema.index({ email: 1, purpose: 1, isUsed: 1 });

module.exports = mongoose.models.PaymentSecurityOtp || mongoose.model('PaymentSecurityOtp', PaymentSecurityOtpSchema);
