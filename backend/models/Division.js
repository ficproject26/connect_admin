const mongoose = require('mongoose');

const DivisionSchema = new mongoose.Schema({
    divisionId: { 
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
    districtId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'District', 
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
    divisionType: { 
        type: String, 
        enum: ['Administrative', 'Custom', 'Commercial', 'Other'], 
        default: 'Administrative' 
    },
    talukInfo: { type: String, default: '' },
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

// Ensure a Division name is unique within the same District
DivisionSchema.index({ districtId: 1, name: 1 }, { unique: true });
DivisionSchema.index({ stateId: 1 });
DivisionSchema.index({ status: 1 });

module.exports = mongoose.model('Division', DivisionSchema);
