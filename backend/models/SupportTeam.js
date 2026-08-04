const mongoose = require('mongoose');

const SupportTeamSchema = new mongoose.Schema({
    employeeId: { type: String, default: '' },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    photo: { type: String, default: '' },
    department: { 
        type: String, 
        enum: ['Customer Support', 'KYC Team', 'Payment Team'], 
        default: 'Customer Support' 
    },
    designation: { 
        type: String, 
        enum: ['Manager', 'Team Leader', 'Staff'], 
        default: 'Staff' 
    },
    role: { type: String, enum: ['agent', 'supervisor', 'admin', 'manager', 'tl', 'staff'], default: 'staff' },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTeam', default: null },
    reportingTL: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTeam', default: null },
    joiningDate: { type: Date, default: Date.now },
    salary: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive', 'onboarding'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

SupportTeamSchema.index({ department: 1, designation: 1 });

module.exports = mongoose.model('SupportTeam', SupportTeamSchema);
