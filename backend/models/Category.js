const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    // Hierarchy level: 'main', 'sub', or 'child'
    level: { type: String, enum: ['main', 'sub', 'child'], required: true },

    // Category name
    name: { type: String, required: true },

    // Slug for URL-safe identification
    slug: { type: String, required: true },

    // Parent reference (null for main categories)
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    // System-locked flag (true for main categories — CANNOT be edited/deleted)
    isSystem: { type: Boolean, default: false },
    isEditable: { type: Boolean, default: true },
    isDeletable: { type: Boolean, default: true },

    // Status & visibility
    isActive: { type: Boolean, default: true },
    isVisible: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },

    // Media
    icon: { type: String, default: '' },
    banner: { type: String, default: '' },
    themeColor: { type: String, default: '' },

    // Description
    description: { type: String, default: '' },

    // Display order within its parent group
    sortOrder: { type: Number, default: 0 },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Compound index for fast tree queries
CategorySchema.index({ parentId: 1, sortOrder: 1 });
CategorySchema.index({ level: 1 });
CategorySchema.index({ slug: 1 });

// Pre-save: auto-update updatedAt
CategorySchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('Category', CategorySchema);
