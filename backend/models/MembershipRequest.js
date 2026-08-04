const mongoose = require('mongoose');

const MembershipRequestSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    customerPhoto: { type: String, default: '' },
    membershipId: { type: String, required: true, unique: true },
    membershipType: { type: String, enum: ['Silver', 'Gold', 'Diamond', 'Premium'], default: 'Silver' },
    paymentMode: { type: String, enum: ['UPI', 'Card', 'Net Banking', 'Wallet', 'Cash'], default: 'UPI' },
    paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Paid' },
    validityStartDate: { type: Date, default: Date.now },
    validityExpiryDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    transactionId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

MembershipRequestSchema.index({ membershipId: 1 });
MembershipRequestSchema.index({ status: 1 });

module.exports = mongoose.model('MembershipRequest', MembershipRequestSchema);
