const mongoose = require('mongoose');
require('dotenv').config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function checkCollections() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('=== CURRENT MONGO DB COLLECTIONS & COUNTS ===');
    for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`Collection: ${col.name.padEnd(25)} | Count: ${count}`);
    }

    await mongoose.disconnect();
}

checkCollections().catch(console.error);
