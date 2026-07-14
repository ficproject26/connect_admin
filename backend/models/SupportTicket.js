const mongoose = require('mongoose');

const SupportTicketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    phone: { type: String },
    issue: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
    assignedTo: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SupportTicket', SupportTicketSchema);
