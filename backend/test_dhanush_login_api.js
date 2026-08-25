const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function testApi() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const uDoc = await db.collection('users').findOne({ email: 'tndis2@gmail.com' });
    const aDoc = await db.collection('agents').findOne({ email: 'tndis2@gmail.com' });

    console.log('USER STATUS IN MONGO DB:', { status: uDoc.status, kycStatus: uDoc.kycStatus, isActive: uDoc.isActive, isApproved: uDoc.isApproved });
    console.log('AGENT STATUS IN MONGO DB:', { status: aDoc.status, kycStatus: aDoc.kycStatus, isActive: aDoc.isActive, isApproved: aDoc.isApproved });

    await mongoose.disconnect();
}

testApi().catch(console.error);
