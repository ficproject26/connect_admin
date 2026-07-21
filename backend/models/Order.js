const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    id: { type: String },
    order_number: { type: String },
    vendorId: { type: mongoose.Schema.Types.Mixed },
    customerId: { type: mongoose.Schema.Types.Mixed },
    amount: { type: Number },
    commission: { type: Number },
    status: { type: String },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Order', OrderSchema);
