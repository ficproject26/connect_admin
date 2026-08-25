const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function fixDhanush() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const User = require('./models/User');

    // Update User collection
    const uRes = await db.collection('users').updateMany(
        { email: 'tndis2@gmail.com' },
        {
            $set: {
                status: 'approved',
                kycStatus: 'approved',
                isActive: true,
                isApproved: true,
                updatedAt: new Date()
            }
        }
    );

    // Update agents collection
    const aRes = await db.collection('agents').updateMany(
        { email: 'tndis2@gmail.com' },
        {
            $set: {
                status: 'approved',
                kycStatus: 'approved',
                isActive: true,
                isApproved: true,
                updatedAt: new Date()
            }
        }
    );

    console.log('=== USER FIX UPDATED:', uRes.modifiedCount);
    console.log('=== AGENTS FIX UPDATED:', aRes.modifiedCount);

    await mongoose.disconnect();
}

fixDhanush().catch(console.error);
