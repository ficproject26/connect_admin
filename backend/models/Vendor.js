const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
    id: { type: String },
    businessName: { type: String, required: true },
    category: { type: String, enum: ['Hospitals', 'Hotels', 'Restaurants', 'Stores', 'Services'], required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Agent reference
    contactName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
    membership: {
        planId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan' },
        status: { type: String, enum: ['active', 'expired', 'none'], default: 'none' },
        expiryDate: { type: Date }
    },
    kycStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
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
});

module.exports = mongoose.model('Vendor', VendorSchema);
