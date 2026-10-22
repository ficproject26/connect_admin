const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/connect_db?retryWrites=true&w=majority';

async function cleanupTestDb() {
    console.log('Connecting to MongoDB cluster0.riukwbj.mongodb.net/test...');
    await mongoose.connect(uri);
    const db = mongoose.connection.client.db('test');

    console.log('\n--- Cleaning obsolete collections in test db ---');
    const obsoleteCollections = [
        'orders',
        'products',
        'payments',
        'banners',
        'subscriptions',
        'subscriptionconfigs',
        'subscriptionpayments',
        'delivery_status_history',
        'settlements',
        'businessrequests',
        'kyc_records'
    ];

    for (const colName of obsoleteCollections) {
        try {
            const count = await db.collection(colName).countDocuments();
            if (count > 0) {
                const res = await db.collection(colName).deleteMany({});
                console.log(`✅ Deleted ${res.deletedCount} documents from ${colName}`);
            } else {
                console.log(`ℹ️ ${colName} is already empty.`);
            }
        } catch (e) {
            console.log(`⚠️ Collection ${colName}: ${e.message}`);
        }
    }

    // In test.users, remove non-admin users (such as test vendors)
    const usersBefore = await db.collection('users').find({}).toArray();
    console.log(`\nUsers in test before: ${usersBefore.length}`);
    const adminFilter = {
        $and: [
            { role: { $nin: ['admin', 'super-admin', 'superadmin', 'main-admin', 'state-admin', 'district-admin', 'division-admin', 'pincode-admin', 'branch-admin', 'staff', 'Super Admin', 'Admin'] } },
            { adminRole: { $nin: ['admin', 'super-admin', 'superadmin', 'main-admin', 'state-admin', 'district-admin', 'division-admin', 'pincode-admin', 'branch-admin', 'staff'] } },
            { email: { $nin: ['admin@example.com', 'admin@vendor.com', 'dhanushiyasri1924@gmail.com', 'dinesh12@gmail.com', 'akash@gmail.com', 'aakash@gmail.com', 'hi@gmail.com', 'north@example.com'] } }
        ]
    };
    const userDeleteRes = await db.collection('users').deleteMany(adminFilter);
    console.log(`✅ Deleted non-admin users in test: ${userDeleteRes.deletedCount}`);
    const usersAfter = await db.collection('users').find({}).toArray();
    console.log(`Remaining users in test: ${usersAfter.length} (${usersAfter.map(u => u.email).join(', ')})`);

    // Verify pincode collections are 100% intact in test
    console.log('\n--- Verifying Pincode Management collections in test ---');
    for (const pCol of ['states', 'districts', 'divisions', 'pincodes']) {
        const c = await db.collection(pCol).countDocuments();
        console.log(`🔒 PRESERVED ${pCol} in test: ${c}`);
    }

    // Verify connect_db as well
    const cDb = mongoose.connection.client.db('connect_db');
    console.log('\n--- Verifying connect_db (Current Database) ---');
    for (const pCol of ['states', 'districts', 'divisions', 'pincodes', 'users', 'admins', 'orders', 'products']) {
        const c = await cDb.collection(pCol).countDocuments();
        console.log(`🔍 connect_db ${pCol}: ${c}`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Cleanup of test database complete.');
    process.exit(0);
}

cleanupTestDb().catch(err => {
    console.error('Fatal error during cleanup:', err);
    process.exit(1);
});
