const mongoose = require('mongoose');

const TieUpSchema = new mongoose.Schema({
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true }, // Services, Product, Daily Need, Food, Stay, Travel, Job
    serviceType: { type: String, required: true }, // e.g., Hospital, Hostel, Bus, AC Repair (Subcategory)
    businessName: { type: String, required: true },
    location: { type: String, required: true },
    pincode: { type: String, required: true },
    businessLicense: { type: String }, // License number or image/proof url
    proofImage: { type: String }, // URL to image/proof
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TieUp', TieUpSchema);
