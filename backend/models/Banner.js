const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
    title: { type: String, required: true },
    imageUrl: { type: String },
    videoUrl: { type: String },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    targetAudience: { type: String, enum: ['all', 'vendor', 'agent', 'customer'], default: 'all' },
    redirectLink: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Banner', BannerSchema);
