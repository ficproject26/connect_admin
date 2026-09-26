const mongoose = require('mongoose');

const MembershipRequestSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.Mixed, default: null },
    customerCode: { type: String, default: '' },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    customerPhoto: { type: String, default: '' },
    membershipId: { type: String, required: true, unique: true },
    membershipType: { type: String, default: 'Silver' },
    paymentMode: { type: String, default: 'UPI' },
    paymentStatus: { type: String, default: 'Paid' },
    validityStartDate: { type: Date, default: Date.now },
    validityExpiryDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: 'Approved' },
    transactionId: { type: String, default: '' },
    orderId: { type: String, default: '' },
    isUpgraded: { type: Boolean, default: false },
    previousTier: { type: String, default: '' },
    upgradeDate: { type: Date, default: null },
    upgradeAmount: { type: Number, default: 0 },
    upgradeTransactionId: { type: String, default: '' },
    history: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

MembershipRequestSchema.index({ status: 1 });
MembershipRequestSchema.index({ transactionId: 1 });
MembershipRequestSchema.index({ customerCode: 1 });

module.exports = mongoose.model('MembershipRequest', MembershipRequestSchema);
