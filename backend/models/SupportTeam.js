const mongoose = require('mongoose');

const SupportTeamSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ['agent', 'supervisor', 'admin'], default: 'agent' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SupportTeam', SupportTeamSchema);
