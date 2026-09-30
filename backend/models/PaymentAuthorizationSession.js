const mongoose = require('mongoose');

const PaymentAuthorizationSessionSchema = new mongoose.Schema({
    authorizationToken: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        index: true
    },
    adminEmail: {
        type: String,
        trim: true,
        lowercase: true
    },
    paymentAuthorizationEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    paymentId: {
        type: String,
        required: true,
        index: true
    },
    recipientId: {
        type: String,
        default: ''
    },
    recipientName: {
        type: String,
        default: ''
    },
    recipientType: {
        type: String,
        default: ''
    },
    amount: {
        type: Number,
        required: true
    },
    paymentPurpose: {
        type: String,
        default: ''
    },
    accountDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    otpVerified: {
        type: Boolean,
        default: false
    },
    otpVerifiedAt: {
        type: Date,
        default: null
    },
    pinVerified: {
        type: Boolean,
        default: false
    },
    pinVerifiedAt: {
        type: Date,
        default: null
    },
    isExecuted: {
        type: Boolean,
        default: false,
        index: true
    },
    executedAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // TTL: 1 hour in MongoDB
    }
});

PaymentAuthorizationSessionSchema.index({ authorizationToken: 1, isExecuted: 1 });

module.exports = mongoose.models.PaymentAuthorizationSession || mongoose.model('PaymentAuthorizationSession', PaymentAuthorizationSessionSchema);
