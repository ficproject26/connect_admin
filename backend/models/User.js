const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.Mixed, default: () => new mongoose.Types.ObjectId() },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'agent', 'Vendor', 'Member', 'vendor', 'member', 'customer', 'Customer'], default: 'agent' },
    level: { type: String, enum: ['state', 'district', 'division', 'pincode'], default: 'pincode' },
    assignedArea: { type: String }, // For state, district, division
    assignedPincode: { type: mongoose.Schema.Types.ObjectId, ref: 'Pincode' },
    assignedDistrict: { type: String }, // For district agents / admin
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // For branch admin / staff / agents
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Referred by agent / parent user
    adminRole: { type: String, enum: ['super-admin', 'branch-admin', 'staff'], default: 'staff' },
    registrationId: { type: String },

    // Agent extended profile fields
    altPhone: { type: String },
    dob: { type: mongoose.Schema.Types.Mixed },
    gender: { type: String },
    qualification: { type: String },
    experience: { type: String },
    previousCompany: { type: String },
    territory: { type: mongoose.Schema.Types.Mixed },
    state: { type: String },
    district: { type: String },
    division: { type: String },
    pincode: { type: String },
    assignedState: { type: String },
    assignedDivision: { type: String },
    postOffice: { type: String },
    fullAddress: { type: String },
    kycDocs: { type: mongoose.Schema.Types.Mixed },

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
        businessProofImage: { type: String },
        educationalCertificates: { type: String },
        cancelledCheque: { type: String }
    },

    status: { type: String, default: 'pending' }, // 'pending', 'approved', 'rejected', 'Pending', 'Approved', 'Rejected'
    rejectionReason: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
    isPaid: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    commissionEarned: { type: Number, default: 0 },
    // Security & Auth Fields
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    isLocked: { type: Boolean, default: false },
    requireCaptcha: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: '' },
    passwordChangedAt: { type: Date, default: Date.now },
    refreshToken: { type: String, default: '' },

    createdAt: { type: Date, default: Date.now }
}, { strict: false, strictPopulate: false });

UserSchema.index({ role: 1, status: 1, level: 1 });
UserSchema.index({ role: 1, branchId: 1, status: 1 });
UserSchema.index({ registrationId: 1 });
UserSchema.index({ email: 1, role: 1 });
UserSchema.index({ assignedState: 1, assignedDistrict: 1, assignedDivision: 1 });
UserSchema.index({ assignedPincode: 1 });
UserSchema.index({ pincode: 1 });
UserSchema.index({ status: 1, createdAt: -1 });
UserSchema.index({ createdAt: -1 });

const castIdToObjectId = (val) => {
    if (val && typeof val === 'object' && (val.$in || val.$eq || val.$nin || val.$ne)) {
        if (val.$ne && typeof val.$ne === 'string' && mongoose.Types.ObjectId.isValid(val.$ne)) {
            return { $nin: [val.$ne, new mongoose.Types.ObjectId(val.$ne)] };
        }
        return val;
    }
    if (typeof val === 'string' && mongoose.Types.ObjectId.isValid(val)) {
        try {
            return { $in: [val, new mongoose.Types.ObjectId(val)] };
        } catch (e) {
            return val;
        }
    }
    if (val instanceof mongoose.Types.ObjectId) {
        return { $in: [val.toString(), val] };
    }
    if (Array.isArray(val)) {
        return val.map(castIdToObjectId);
    }
    if (val && typeof val === 'object' && !(val instanceof mongoose.Types.ObjectId)) {
        const newObj = {};
        for (const key of Object.keys(val)) {
            newObj[key] = castIdToObjectId(val[key]);
        }
        return newObj;
    }
    return val;
};

UserSchema.pre(/^find/, function() {
    const query = this.getQuery();
    if (query._id) {
        query._id = castIdToObjectId(query._id);
    }
});

UserSchema.pre(/^update/, function() {
    const query = this.getQuery();
    if (query._id) {
        query._id = castIdToObjectId(query._id);
    }
});

UserSchema.index({ role: 1, status: 1, level: 1 });
UserSchema.index({ role: 1, isApproved: 1, isActive: 1 });
UserSchema.index({ role: 1, branchId: 1, status: 1 });
UserSchema.index({ assignedState: 1, assignedDistrict: 1 });

UserSchema.pre(/^delete/, function() {
    const query = this.getQuery();
    if (query._id) {
        query._id = castIdToObjectId(query._id);
    }
});

module.exports = mongoose.model('User', UserSchema);

