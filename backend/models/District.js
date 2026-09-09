const mongoose = require('mongoose');

const DistrictSchema = new mongoose.Schema({
    districtId: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true,
        uppercase: true 
    },
    stateId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'State', 
        required: true 
    },
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    code: { 
        type: String, 
        required: true, 
        trim: true, 
        uppercase: true 
    },
    headquarters: { type: String, default: '' },
    description: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: { 
        type: String, 
        enum: ['Active', 'Inactive'], 
        default: 'Active' 
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

// Ensure a District name is unique within the same State
DistrictSchema.index({ stateId: 1, name: 1 }, { unique: true });
DistrictSchema.index({ stateId: 1, code: 1 });
DistrictSchema.index({ status: 1 });

module.exports = mongoose.model('District', DistrictSchema);
