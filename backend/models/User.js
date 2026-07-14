const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.Mixed },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'agent', 'Vendor', 'Member', 'vendor', 'member'], default: 'agent' },
    level: { type: String, enum: ['state', 'district', 'division', 'pincode'], default: 'pincode' },
    assignedArea: { type: String }, // For state, district, division
    assignedPincode: { type: mongoose.Schema.Types.ObjectId, ref: 'Pincode' },
    assignedDistrict: { type: String }, // For district agents / admin
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // For branch admin / staff / agents
    adminRole: { type: String, enum: ['super-admin', 'branch-admin', 'staff'], default: 'staff' },
    
    // Vendor profile fields
    vendorType: { type: String },
    category: { type: String },
    subcategory: { type: String },
    baseVendorType: { type: String },
    businessName: { type: String },
    contactPerson: { type: String },
    address: { type: String },
    paymentOptions: { type: mongoose.Schema.Types.Mixed },
    bankDetails: { type: mongoose.Schema.Types.Mixed },

    // KYC Data
    kyc: {
        aadhaarNumber: { type: String },
        aadhaarImage: { type: String },
        panNumber: { type: String },
        panImage: { type: String },
        selfie: { type: String },
        businessProofImage: { type: String }
    },

    status: { type: String, default: 'pending' }, // 'pending', 'approved', 'rejected', 'Pending', 'Approved', 'Rejected'
    isActive: { type: Boolean, default: false },
    isPaid: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    commissionEarned: { type: Number, default: 0 },
    vendorsAdded: { type: Number, default: 0 },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);

