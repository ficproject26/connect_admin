const mongoose = require('mongoose');

const WithdrawalRequestSchema = new mongoose.Schema({
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed', 'Pending', 'Approved', 'Rejected', 'Completed'], default: 'pending' },
    accountHolderName: { type: String },
    bankName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    branchName: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WithdrawalRequest', WithdrawalRequestSchema);
