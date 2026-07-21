const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    aadhaarNumber: { type: String, default: '' },
    panNumber: { type: String, default: '' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Customer', CustomerSchema);
