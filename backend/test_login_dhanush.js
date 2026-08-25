const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function checkLogin() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const User = require('./models/User');

    const user = await User.findOne({ email: 'tndis2@gmail.com' });
    const rawAgent = await db.collection('agents').findOne({ email: 'tndis2@gmail.com' });

    console.log('=== USER DOCUMENT IN DB ===');
    console.log('User status:', user ? user.status : 'N/A');
    console.log('User kycStatus:', user ? user.kycStatus : 'N/A');
    console.log('User isActive:', user ? user.isActive : 'N/A');
    console.log('User isApproved:', user ? user.isApproved : 'N/A');
    console.log('User role:', user ? user.role : 'N/A');

    console.log('\n=== RAW AGENT DOCUMENT IN DB ===');
    console.log('Agent status:', rawAgent ? rawAgent.status : 'N/A');
    console.log('Agent kycStatus:', rawAgent ? rawAgent.kycStatus : 'N/A');
    console.log('Agent isActive:', rawAgent ? rawAgent.isActive : 'N/A');
    console.log('Agent isApproved:', rawAgent ? rawAgent.isApproved : 'N/A');

    await mongoose.disconnect();
}

checkLogin().catch(console.error);
