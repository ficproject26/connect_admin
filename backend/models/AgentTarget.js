const mongoose = require('mongoose');

const AgentTargetSchema = new mongoose.Schema({
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    period: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
    year: { type: Number, default: () => new Date().getFullYear() },
    month: { type: Number, default: () => new Date().getMonth() + 1 }, // 1-12
    targets: {
        registrations: { type: Number, default: 100 },
        membershipSales: { type: Number, default: 50 },
        vendorOnboarding: { type: Number, default: 25 },
        orders: { type: Number, default: 500 },
        revenue: { type: Number, default: 500000 }
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AgentTarget', AgentTargetSchema);
