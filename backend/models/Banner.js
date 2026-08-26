const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
    title: { type: String, default: 'Special Promotion' },
    imageUrl: { type: String },
    videoUrl: { type: String },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    targetAudience: { type: String, default: 'all' },
    redirectLink: { type: String, default: '/promotions' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Banner', BannerSchema);
