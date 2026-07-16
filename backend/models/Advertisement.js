const mongoose = require('mongoose');

const AdvertisementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    imageUrl: { type: String },
    videoUrl: { type: String },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    targetAudience: { type: String, enum: ['all', 'vendor', 'agent', 'customer'], default: 'all' },
    redirectLink: { type: String },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 }, // Click Through Rate in %
    revenue: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Advertisement', AdvertisementSchema);
