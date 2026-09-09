const mongoose = require('mongoose');

const StateSchema = new mongoose.Schema({
    stateId: { 
        type: String, 
        required: true, 
        unique: true, 
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

StateSchema.index({ name: 1 });
StateSchema.index({ code: 1 });
StateSchema.index({ status: 1 });

module.exports = mongoose.model('State', StateSchema);
