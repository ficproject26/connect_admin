const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    id: { type: String },
    order_number: { type: String },
    vendorId: { type: mongoose.Schema.Types.Mixed },
    customerId: { type: mongoose.Schema.Types.Mixed },
    amount: { type: Number },
    commission: { type: Number },
    status: { type: String },
    type: { type: String },
    candidateEmail: { type: String },
    candidateResume: { type: String },
    experience: { type: String },
    candidateEducation: { type: String },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

OrderSchema.index({ vendorId: 1 });
OrderSchema.index({ customerId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);
