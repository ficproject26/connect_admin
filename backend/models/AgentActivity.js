const mongoose = require('mongoose');

const AgentActivitySchema = new mongoose.Schema({
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actionType: {
        type: String,
        enum: [
            'login',
            'add_vendor',
            'register_customer',
            'membership_sold',
            'booking_completed',
            'revenue_generated',
            'call_made',
            'meeting_conducted',
            'task_completed',
            'order_generated'
        ],
        required: true
    },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now }
});

AgentActivitySchema.index({ agentId: 1, actionType: 1 });
AgentActivitySchema.index({ timestamp: -1 });

module.exports = mongoose.model('AgentActivity', AgentActivitySchema);
