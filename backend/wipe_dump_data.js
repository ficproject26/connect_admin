const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

const wipeDumpData = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        const db = mongoose.connection.db;

        const collections = await db.listCollections().toArray();
        console.log(`Found ${collections.length} collections in DB.`);

        for (const col of collections) {
            const name = col.name;
            if (name === 'users') {
                // Delete all users except super admin
                const res = await db.collection('users').deleteMany({
                    email: { $ne: 'admin@example.com' }
                });
                console.log(`Cleared non-admin records in '${name}' collection. Deleted: ${res.deletedCount}`);
            } else if (name === 'categories') {
                // Preserve system default categories
                console.log(`Skipped clearing system category definitions in '${name}'.`);
            } else {
                const res = await db.collection(name).deleteMany({});
                console.log(`Cleared collection '${name}'. Deleted: ${res.deletedCount}`);
            }
        }

        console.log('\n✅ All dump data and test records successfully removed from MongoDB database!');
        console.log('✅ Super Admin account (admin@example.com) preserved.');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error wiping dump data:', err);
        process.exit(1);
    }
};

wipeDumpData();
