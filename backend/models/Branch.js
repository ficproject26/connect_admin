const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    state: { type: String, required: true },
    district: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
    contactNumber: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Branch', BranchSchema);
