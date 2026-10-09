const mongoose = require('mongoose');

const StateSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.Mixed },
    stateId: { 
        type: String, 
        trim: true,
        uppercase: true 
    },
    name: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true 
    },
    code: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true, 
        uppercase: true 
    },
    status: { 
        type: String, 
        enum: ['Active', 'Inactive'], 
        default: 'Active' 
    },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.Mixed, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.Mixed, ref: 'User' }
}, {
    timestamps: true
});

StateSchema.index({ status: 1 });

module.exports = mongoose.model('State', StateSchema);
