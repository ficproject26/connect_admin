const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function updateVendorDoc() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const res = await db.collection('users').updateOne(
        { email: 'hrblr@forgeindiaconnect.com' },
        {
            $set: {
                phone: '9876543210',
                city: 'Bangalore',
                district: 'Bangalore',
                state: 'Karnataka',
                assignedState: 'Karnataka',
                assignedDistrict: 'Bangalore',
                assignedArea: 'Karnataka / Bangalore',
                updatedAt: new Date()
            }
        }
    );

    console.log('=== HRBLR VENDOR MONGO RECORD UPDATED:', res.modifiedCount);

    await mongoose.disconnect();
}

updateVendorDoc().catch(console.error);
