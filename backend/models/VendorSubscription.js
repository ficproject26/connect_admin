const mongoose = require('mongoose');

const VendorSubscriptionSchema = new mongoose.Schema({
    subscriptionId: {
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
        default: 'Vendor'
    },
    vendorEmail: {
        type: String,
        default: ''
    },
    vendorPhone: {
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
        default: 'Products',
        index: true
    },
    category: {
        type: String,
        default: ''
    },
    address: {
        type: String,
        default: ''
    },
    state: {
        type: String,
        required: true,
        index: true
    },
    district: {
        type: String,
        required: true,
        index: true
    },
    division: {
        type: String,
        required: true,
        index: true
    },
    pincode: {
        type: String,
        required: true,
        index: true
    },
    stateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'State',
        default: null
    },
    districtId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'District',
        default: null
    },
    divisionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Division',
        default: null
    },
    pincodeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pincode',
        default: null
    },
    planName: {
        type: String,
        default: 'Monthly Subscription'
    },
    monthlyFee: {
        type: Number,
        default: 1000
    },
    amount: {
        type: Number,
        default: 1000
    },
    currency: {
        type: String,
        default: 'INR'
    },
    billingCycle: {
        type: String,
        default: 'Monthly'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date,
        default: null
    },
    endDate: {
        type: Date,
        default: null
    },
    nextDueDate: {
        type: Date,
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['PAID', 'SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'],
        default: 'PENDING',
        index: true
    },
    subscriptionStatus: {
        type: String,
        enum: ['ACTIVE', 'PENDING', 'EXPIRED', 'PAYMENT PENDING', 'PAYMENT FAILED', 'SUSPENDED'],
        default: 'ACTIVE',
        index: true
    },
    status: {
        type: String,
        default: 'Active'
    },
    paymentMethod: {
        type: String,
        default: 'Online'
    },
    paymentDate: {
        type: Date,
        default: null
    },
    lastPaymentDate: {
        type: Date,
        default: null
    },
    paymentId: {
        type: String,
        default: ''
    },
    latestPaymentId: {
        type: String,
        default: ''
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
    transactionId: {
        type: String,
        default: ''
    },
    approvedBy: {
        type: String,
        default: ''
    },
    approvedByName: {
        type: String,
        default: ''
    },
    approvedByRole: {
        type: String,
        default: ''
    },
    approverId: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    approvalDate: {
        type: Date,
        default: null
    },
    notes: {
        type: String,
        default: ''
    },
    renewalCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    collection: 'subscriptions',
    strict: false
});

// Composite Indexes for high performance hierarchy queries
VendorSubscriptionSchema.index({ state: 1, district: 1, division: 1, pincode: 1 });
VendorSubscriptionSchema.index({ vendorId: 1, businessId: 1 });
VendorSubscriptionSchema.index({ paymentStatus: 1, subscriptionStatus: 1 });
VendorSubscriptionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VendorSubscription', VendorSubscriptionSchema, 'subscriptions');
