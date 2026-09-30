const mongoose = require('mongoose');

const PaymentSecuritySettingsSchema = new mongoose.Schema({
    paymentAuthorizationEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    transactionPinHash: {
        type: String,
        default: null
    },
    failedPinAttempts: {
        type: Number,
        default: 0
    },
    pinLockedUntil: {
        type: Date,
        default: null
    },
    tempNewEmail: {
        type: String,
        default: null,
        trim: true,
        lowercase: true
    },
    emailChangeOldVerified: {
        type: Boolean,
        default: false
    },
    updatedBy: {
        type: mongoose.Schema.Types.Mixed,
        ref: 'User'
    }
}, { timestamps: true });

PaymentSecuritySettingsSchema.index({ paymentAuthorizationEmail: 1 });

module.exports = mongoose.models.PaymentSecuritySettings || mongoose.model('PaymentSecuritySettings', PaymentSecuritySettingsSchema);
