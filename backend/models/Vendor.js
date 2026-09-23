const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
    id: { type: String },
    businessName: { type: String, required: true },
    category: { type: String, default: 'General Store' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Agent reference
    contactName: { type: String },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, default: 'pending' },
    isActive: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    membership: {
        planId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan' },
        status: { type: String, default: 'none' },
        expiryDate: { type: Date }
    },
    kycStatus: { type: String, default: 'pending' },
    kycDocs: {
        aadhaarNumber: { type: String },
        aadhaarImage: { type: String },
        panNumber: { type: String },
        panImage: { type: String },
        selfie: { type: String },
        businessProofImage: { type: String }
    },
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
}, { strict: false, strictPopulate: false });

VendorSchema.index({ status: 1, category: 1 });
VendorSchema.index({ status: 1, branchId: 1 });
VendorSchema.index({ category: 1, branchId: 1 });
VendorSchema.index({ kycStatus: 1 });
VendorSchema.index({ agentId: 1 });
VendorSchema.index({ email: 1, phone: 1 });
VendorSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Vendor', VendorSchema);
