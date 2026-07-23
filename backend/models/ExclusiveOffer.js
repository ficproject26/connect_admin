const mongoose = require('mongoose');

const ExclusiveOfferSchema = new mongoose.Schema({
    title: { type: String, required: true },
    discount: { type: String, required: true },
    code: { type: String, required: true },
    category: { type: String, default: 'Services' },
    desc: { type: String },
    imageUrl: { type: String },
    redirectLink: { type: String },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExclusiveOffer', ExclusiveOfferSchema);
