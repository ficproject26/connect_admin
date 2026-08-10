const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

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
