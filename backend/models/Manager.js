const mongoose = require('mongoose');

const ManagerSchema = new mongoose.Schema({
    managerId: {
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
    parentAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Suspended'],
        default: 'Active'
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

ManagerSchema.index({ email: 1 });
ManagerSchema.index({ phone: 1 });
ManagerSchema.index({ level: 1, assignedState: 1, assignedDistrict: 1, assignedDivision: 1, assignedPincode: 1 });
ManagerSchema.index({ status: 1 });

module.exports = mongoose.model('Manager', ManagerSchema);
