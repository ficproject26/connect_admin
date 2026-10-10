const mongoose = require('mongoose');

const ManagerRequestSchema = new mongoose.Schema({
    requestId: {
        type: String,
        unique: true,
        trim: true,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    altPhone: {
        type: String,
        default: '',
        trim: true
    },
    level: {
        type: String,
        enum: ['state', 'district', 'division', 'pincode'],
        required: true
    },
    assignedState: {
        type: String,
        required: true,
        trim: true
    },
    assignedDistrict: {
        type: String,
        default: '',
        trim: true
    },
    assignedDivision: {
        type: String,
        default: '',
        trim: true
    },
    assignedPincode: {
        type: String,
        default: '',
        trim: true
    },
    address: {
        type: String,
        default: '',
        trim: true
    },
    notes: {
        type: String,
        default: ''
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        default: null
    },
    userId: {
        type: String,
        default: null,
        trim: true
    },
    requestingAdminName: {
        type: String,
        default: ''
    },
    requestingAdminRole: {
        type: String,
        default: ''
    },
    targetAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    targetAdminName: {
        type: String,
        default: ''
    },
    targetAdminRole: {
        type: String,
        default: ''
    },
    approvalStage: {
        type: String,
        enum: ['subadmin_review', 'kyc_review', 'approved', 'rejected'],
        default: 'subadmin_review'
    },
    subadminApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    subadminApprovedByName: {
        type: String,
        default: ''
    },
    subadminApprovedAt: {
        type: Date,
        default: null
    },
    kycApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    kycApprovedByName: {
        type: String,
        default: ''
    },
    kycApprovedAt: {
        type: Date,
        default: null
    },
    documents: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    rejectionReason: {
        type: String,
        default: ''
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

ManagerRequestSchema.index({ status: 1 });
ManagerRequestSchema.index({ level: 1, assignedState: 1, assignedDistrict: 1, assignedDivision: 1, assignedPincode: 1, status: 1 });
ManagerRequestSchema.index({ requestedBy: 1 });

module.exports = mongoose.model('ManagerRequest', ManagerRequestSchema);
