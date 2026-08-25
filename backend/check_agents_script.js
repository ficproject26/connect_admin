const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function check() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const agents = await db.collection('users').find({
        role: { $in: ['agent', 'Agent', 'State Agent', 'District Agent', 'Divisional Agent', 'Pincode Agent'] }
    }).toArray();

    const standaloneAgents = await db.collection('agents').find({}).toArray();
    const allUsers = await db.collection('users').find({}).toArray();

    console.log('=== USERS AGENTS COUNT:', agents.length);
    console.log('=== USERS AGENTS:', JSON.stringify(agents, null, 2));

    console.log('=== STANDALONE AGENTS COUNT:', standaloneAgents.length);
    console.log('=== STANDALONE AGENTS:', JSON.stringify(standaloneAgents, null, 2));

    console.log('=== ALL USERS COUNT:', allUsers.length);

    await mongoose.disconnect();
}

check().catch(console.error);
