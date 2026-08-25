const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function updateSwethaDoc() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const res = await db.collection('users').updateOne(
        { email: 'swetha@gmail.com' },
        {
            $set: {
                city: 'Thalaivasal',
                district: 'Salem',
                state: 'Tamil Nadu',
                assignedState: 'Tamil Nadu',
                assignedDistrict: 'Salem',
                assignedDivision: 'Attur / Thalaivasal',
                assignedArea: 'Tamil Nadu / Salem / Thalaivasal',
                updatedAt: new Date()
            }
        }
    );

    console.log('=== SWETHA VENDOR MONGO RECORD UPDATED:', res.modifiedCount);

    await mongoose.disconnect();
}

updateSwethaDoc().catch(console.error);
