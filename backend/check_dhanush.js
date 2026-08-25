const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function check() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const userDoc = await db.collection('users').findOne({ email: 'tndis2@gmail.com' });
    const agentDoc = await db.collection('agents').findOne({ email: 'tndis2@gmail.com' });

    console.log('=== USER COLLECTION RECORD FOR tndis2@gmail.com ===');
    console.log(JSON.stringify(userDoc, null, 2));

    console.log('=== AGENTS COLLECTION RECORD FOR tndis2@gmail.com ===');
    console.log(JSON.stringify(agentDoc, null, 2));

    await mongoose.disconnect();
}

check().catch(console.error);
