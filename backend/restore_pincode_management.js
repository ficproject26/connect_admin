const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function restorePincodeBackup() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/connect_db?retryWrites=true&w=majority';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);

    const backupDir = path.join(__dirname, 'data', 'backup_pincode_management_2026-10-22T10-56-34-348Z');
    if (!fs.existsSync(backupDir)) {
        console.error('Backup directory not found:', backupDir);
        process.exit(1);
    }

    const collections = ['states', 'districts', 'divisions', 'pincodes', 'pincodeassignments', 'territoryauditlogs'];

    for (const dbName of ['test', 'connect_db']) {
        const db = mongoose.connection.client.db(dbName);
        console.log(`\n=== Verifying / Restoring in ${dbName} ===`);
        for (const colName of collections) {
            const filePath = path.join(backupDir, colName + '.json');
            if (fs.existsSync(filePath)) {
                const docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                const currentCount = await db.collection(colName).countDocuments();
                console.log(`  ${colName}: current=${currentCount}, backup=${docs.length}`);
                if (currentCount === 0 && docs.length > 0) {
                    console.log(`  Restoring ${docs.length} records into ${colName}...`);
                    await db.collection(colName).insertMany(docs);
                    console.log(`  ✅ Restored ${colName}`);
                }
            }
        }
    }

    console.log('\n✅ Pincode management verification/restore check complete.');
    process.exit(0);
}

if (require.main === module) {
    restorePincodeBackup().catch(err => {
        console.error('Restore error:', err);
        process.exit(1);
    });
}

module.exports = restorePincodeBackup;
