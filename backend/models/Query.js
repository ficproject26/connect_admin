const mongoose = require('mongoose');

const QuerySchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['unread', 'read', 'resolved'], default: 'unread' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Query', QuerySchema);
