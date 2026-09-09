const mongoose = require('mongoose');

const PincodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, trim: true },
    pincodeId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    postOffice: { type: String, trim: true }, // same as name sometimes
    taluk: { type: String, default: '', trim: true },
    area: { type: String, default: '', trim: true },
    district: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    division: { type: String, default: '', trim: true },
    region: { type: String, default: '', trim: true },
    deliveryStatus: { type: String, default: 'Delivery' },
    status: { 
        type: String, 
        enum: ['Active', 'Inactive'], 
        default: 'Active' 
    },
    description: { type: String, default: '' },
    notes: { type: String, default: '' },

    // Hierarchy Relational IDs
    stateId: { type: mongoose.Schema.Types.ObjectId, ref: 'State', default: null },
    districtId: { type: mongoose.Schema.Types.ObjectId, ref: 'District', default: null },
    divisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', default: null },

    activeAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    joiningFee: { type: Number, default: 100000 },
    isBlocked: { type: Boolean, default: false }
}, {
    timestamps: true
});

PincodeSchema.index({ activeAgentId: 1 });
PincodeSchema.index({ district: 1, state: 1 });
PincodeSchema.index({ stateId: 1, districtId: 1, divisionId: 1 });
PincodeSchema.index({ status: 1 });

module.exports = mongoose.model('Pincode', PincodeSchema);
