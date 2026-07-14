const mongoose = require('mongoose');

const AdvertisementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    redirectLink: { type: String },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 }, // Click Through Rate in %
    revenue: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Advertisement', AdvertisementSchema);
