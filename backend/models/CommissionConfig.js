const mongoose = require('mongoose');

const CommissionConfigSchema = new mongoose.Schema({
    scope: { type: String, enum: ['global', 'branch', 'vendor', 'agent'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null }, // ID of branch, vendor, or agent depending on scope
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true }, // e.g. 5 for 5% or 100 for 100 INR fixed
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CommissionConfig', CommissionConfigSchema);
