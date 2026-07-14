const mongoose = require('mongoose');

const DeliveryPartnerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    vehicleType: { type: String, enum: ['2-wheeler', '3-wheeler', '4-wheeler'], default: '2-wheeler' },
    vehicleNumber: { type: String },
    city: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeliveryPartner', DeliveryPartnerSchema);
