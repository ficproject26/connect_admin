const mongoose = require('mongoose');

const PincodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    postOffice: { type: String }, // same as name sometimes
    district: { type: String, required: true },
    state: { type: String, required: true },
    division: { type: String },
    region: { type: String },
    deliveryStatus: { type: String },
    activeAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    joiningFee: { type: Number, default: 100000 }, // Default fee, can be overridden by admin
    isBlocked: { type: Boolean, default: false }
});

module.exports = mongoose.model('Pincode', PincodeSchema);
