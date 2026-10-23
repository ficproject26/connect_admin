const mongoose = require('mongoose');

const ManagerSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.Mixed },
    managerId: {
        type: String,
        unique: true,
        trim: true,
        sparse: true
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
        trim: true
    },
    mobile: {
        type: String,
        trim: true
    },
    altPhone: {
        type: String,
        default: '',
        trim: true
    },
    level: {
        type: mongoose.Schema.Types.Mixed,
        default: 'state'
    },
    assignedState: {
        type: String,
        trim: true
    },
    state: {
        type: String,
        trim: true
    },
    assignedDistrict: {
        type: String,
        default: '',
        trim: true
    },
    district: {
        type: String,
        default: '',
        trim: true
    },
    assignedDivision: {
        type: String,
        default: '',
        trim: true
    },
    division: {
        type: String,
        default: '',
        trim: true
    },
    assignedPincode: {
        type: String,
        default: '',
        trim: true
    },
    pincode: {
        type: String,
        default: '',
        trim: true
    },
    address: {
        type: String,
        default: '',
        trim: true
    },
    parentAdminId: {
        type: mongoose.Schema.Types.Mixed,
        ref: 'User',
        default: null
    },
    requestedBy: {
        type: mongoose.Schema.Types.Mixed,
        ref: 'User',
        default: null
    },
    approvedBy: {
        type: mongoose.Schema.Types.Mixed,
        ref: 'User',
        default: null
    },
    status: {
        type: String,
        default: 'Active'
    },
    notes: {
        type: String,
        default: ''
    },
    bankDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, {
    timestamps: true,
    strict: false,
    strictPopulate: false
});

ManagerSchema.index({ email: 1 });
ManagerSchema.index({ phone: 1 });
ManagerSchema.index({ level: 1, assignedState: 1, assignedDistrict: 1, assignedDivision: 1, assignedPincode: 1 });
ManagerSchema.index({ status: 1 });

module.exports = mongoose.model('Manager', ManagerSchema);
