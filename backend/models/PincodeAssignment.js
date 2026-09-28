const mongoose = require('mongoose');

const PincodeAssignmentSchema = new mongoose.Schema({
    pincode: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    pincodeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pincode',
        default: null,
        index: true
    },
    state: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    district: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    division: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    stateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'State',
        default: null
    },
    districtId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'District',
        default: null
    },
    divisionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Division',
        default: null
    },
    assignedAdminId: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
        index: true
    },
    assignedManagerId: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
        index: true
    },
    assignedAgentId: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
        index: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Suspended'],
        default: 'Active'
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

PincodeAssignmentSchema.index({ pincode: 1, division: 1 }, { unique: true });
PincodeAssignmentSchema.index({ district: 1, state: 1 });
PincodeAssignmentSchema.index({ status: 1 });

module.exports = mongoose.model('PincodeAssignment', PincodeAssignmentSchema);
