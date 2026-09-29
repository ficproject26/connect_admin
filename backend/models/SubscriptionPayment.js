const mongoose = require('mongoose');

const SubscriptionPaymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    vendorId: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        index: true
    },
    vendorName: {
        type: String,
        default: ''
    },
    businessId: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        index: true
    },
    businessName: {
        type: String,
        required: true
    },
    businessType: {
        type: String,
        default: 'Products'
    },
    subscriptionId: {
        type: String,
        required: true,
        index: true
    },
    subscriptionType: {
        type: String,
        default: 'Monthly Subscription'
    },
    razorpayOrderId: {
        type: String,
        default: ''
    },
    razorpayPaymentId: {
        type: String,
        default: ''
    },
    razorpaySignature: {
        type: String,
        default: ''
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    paymentMethod: {
        type: String,
        default: 'UPI'
    },
    paymentStatus: {
        type: String,
        enum: ['SUCCESS', 'PAID', 'PENDING', 'FAILED', 'REFUNDED'],
        default: 'PENDING',
        index: true
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date,
        default: null
    },
    state: {
        type: String,
        default: ''
    },
    district: {
        type: String,
        default: ''
    },
    division: {
        type: String,
        default: ''
    },
    pincode: {
        type: String,
        default: ''
    },
    approvedBy: {
        type: String,
        default: ''
    },
    failureReason: {
        type: String,
        default: ''
    }
}, {
    timestamps: true,
    collection: 'subscriptionpayments',
    strict: false
});

SubscriptionPaymentSchema.index({ state: 1, district: 1, division: 1, pincode: 1 });
SubscriptionPaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SubscriptionPayment', SubscriptionPaymentSchema, 'subscriptionpayments');
