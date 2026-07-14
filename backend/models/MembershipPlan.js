const mongoose = require('mongoose');

const MembershipPlanSchema = new mongoose.Schema({
    name: { type: String, required: true },
    duration: { type: Number, required: true }, // in days
    price: { type: Number, required: true },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MembershipPlan', MembershipPlanSchema);
