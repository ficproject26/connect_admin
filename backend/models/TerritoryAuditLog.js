const mongoose = require('mongoose');

const TerritoryAuditLogSchema = new mongoose.Schema({
    action: { 
        type: String, 
        required: true,
        trim: true 
    },
    actorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    },
    actorName: { type: String, default: 'Super Admin' },
    actorRole: { type: String, default: 'superadmin' },
    territoryId: { type: String, default: '' },
    territoryType: { 
        type: String, 
        enum: ['State', 'District', 'Division', 'Pincode'], 
        required: true 
    },
    territoryName: { type: String, default: '' },
    previousValue: { type: Object, default: null },
    newValue: { type: Object, default: null },
    reason: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
}, {
    timestamps: true
});

TerritoryAuditLogSchema.index({ timestamp: -1 });
TerritoryAuditLogSchema.index({ territoryType: 1, territoryId: 1 });
TerritoryAuditLogSchema.index({ actorId: 1 });

module.exports = mongoose.model('TerritoryAuditLog', TerritoryAuditLogSchema);
