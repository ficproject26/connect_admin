const mongoose = require('mongoose');

const JobAppliedSchema = new mongoose.Schema({
    candidateName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    position: { type: String, required: true },
    experience: { type: String },
    resumeUrl: { type: String, default: '' },
    status: { type: String, enum: ['applied', 'interviewing', 'selected', 'rejected'], default: 'applied' },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('JobApplied', JobAppliedSchema);
