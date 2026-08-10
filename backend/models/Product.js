const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, default: 'General' },
    subcategory: { type: String, default: '' },
    price: { type: Number, default: 0 },
    discountPrice: { type: Number, default: 0 },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    images: [{ type: String }],
    stock: { type: Number, default: 100 },
    isAvailable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Product', ProductSchema);
