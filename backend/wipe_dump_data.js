const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

const wipeDumpData = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        const db = mongoose.connection.db;

        const collections = await db.listCollections().toArray();
        console.log(`Found ${collections.length} collections in DB.`);

        const isConfirmed = process.argv.includes('--confirm');
        const isDryRunArg = process.argv.includes('--dry-run');
        const isDryRun = isDryRunArg || !isConfirmed;

        if (isDryRun) {
            console.log('🔍 DRY RUN MODE: No records will be deleted.');
            if (!isDryRunArg && !isConfirmed) {
                console.log('⚠️  Notice: Running in safe DRY RUN mode by default. To execute actual destructive deletion of dump records, pass the --confirm flag.');
            }
        }

        const PROTECTED_COLLECTIONS = new Set([
            'categories',
            'states',
            'districts',
            'divisions',
            'pincodes',
            'territoryauditlogs',
            'pincodeassignments'
        ]);

        for (const col of collections) {
            const name = col.name;
            const normalizedName = (name || '').toLowerCase().trim();
            if (normalizedName === 'users') {
                // Delete all non-administrative users, strictly preserving all admin accounts
                const adminFilter = {
                    $and: [
                        { role: { $nin: ['admin', 'super-admin', 'superadmin', 'main-admin', 'state-admin', 'district-admin', 'division-admin', 'pincode-admin', 'branch-admin', 'staff'] } },
                        { adminRole: { $nin: ['admin', 'super-admin', 'superadmin', 'main-admin', 'state-admin', 'district-admin', 'division-admin', 'pincode-admin', 'branch-admin', 'staff'] } },
                        { email: { $nin: ['admin@example.com', 'admin@vendor.com', 'dhanushiyasri1924@gmail.com', 'dinesh12@gmail.com', 'akash@gmail.com', 'aakash@gmail.com', 'hi@gmail.com', 'north@example.com'] } }
                    ]
                };
                if (isDryRun) {
                    const count = await db.collection('users').countDocuments(adminFilter);
                    console.log(`[DRY RUN] Would delete ${count} non-admin records in '${name}' collection.`);
                } else {
                    const res = await db.collection('users').deleteMany(adminFilter);
                    console.log(`Cleared non-admin records in '${name}' collection. Deleted: ${res.deletedCount}`);
                }
            } else if (PROTECTED_COLLECTIONS.has(normalizedName)) {
                // Preserve critical system definitions and administrative territory collections
                console.log(`🛡️  [PROTECTED] Preserved administrative territory & core structure in '${name}'. Skipped.`);
            } else {
                if (isDryRun) {
                    const count = await db.collection(name).countDocuments({});
                    console.log(`[DRY RUN] Would clear collection '${name}' (${count} documents).`);
                } else {
                    const res = await db.collection(name).deleteMany({});
                    console.log(`Cleared collection '${name}'. Deleted: ${res.deletedCount}`);
                }
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
