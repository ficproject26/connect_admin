const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function testPerf() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const User = require('./models/User');
    const agentFilter = { role: { $in: ['agent', 'Agent'] } };

    const userAgents = await User.find(agentFilter).lean();
    let rawAgents = [];
    if (db) {
        try {
            rawAgents = await db.collection('agents').find({}).toArray();
        } catch (aErr) {}
    }

    const agentMap = new Map();
    userAgents.forEach(a => {
        const key = (a.registrationId || a.email || (a._id ? a._id.toString() : '')).toLowerCase().trim();
        if (key) agentMap.set(key, a);
    });

    rawAgents.forEach(raw => {
        const key = (raw.registrationId || raw.email || (raw._id ? raw._id.toString() : '')).toLowerCase().trim();
        if (key && !agentMap.has(key)) {
            const levelVal = (raw.level || raw.role || 'pincode').toLowerCase();
            const cleanLevel = levelVal.includes('state') ? 'state' : levelVal.includes('district') ? 'district' : (levelVal.includes('divis') || levelVal.includes('division')) ? 'division' : 'pincode';
            agentMap.set(key, {
                ...raw,
                _id: raw._id || new mongoose.Types.ObjectId(),
                role: 'agent',
                level: cleanLevel,
                assignedArea: raw.assignedArea || (raw.territory ? Object.values(raw.territory).filter(Boolean).join(' / ') : ''),
                status: raw.status || raw.kycStatus || 'approved',
                isActive: raw.isActive !== false
            });
        }
    });

    const allAgents = Array.from(agentMap.values());
    console.log('=== TOTAL COMBINED AGENTS FOR PERFORMANCE:', allAgents.length);
    console.log('=== COMBINED AGENTS LIST:', JSON.stringify(allAgents.map(a => ({ name: a.name, level: a.level, email: a.email, status: a.status })), null, 2));

    await mongoose.disconnect();
}

testPerf().catch(console.error);
