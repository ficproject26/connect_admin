const mongoose = require('mongoose');

const CardHolderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    cardType: { type: String, enum: ['Gold', 'Silver', 'Platinum'], default: 'Gold' },
    cardNumber: { type: String, required: true, unique: true },
    expiryDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'expired', 'suspended'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CardHolder', CardHolderSchema);
