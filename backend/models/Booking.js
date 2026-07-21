const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.Mixed },
    customerId: { type: mongoose.Schema.Types.Mixed },
    amount: { type: Number },
    commission: { type: Number },
    status: { type: String },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Booking', BookingSchema);
