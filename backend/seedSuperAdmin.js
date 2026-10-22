const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    console.log('Connecting to MongoDB cluster...');
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const adminUsers = [
        {
            name: 'Super Admin',
            email: 'admin@example.com',
            password: hashedPassword,
            role: 'super-admin',
            adminRole: 'super-admin',
            adminLevel: 'main',
            level: 'main',
            status: 'approved',
            isActive: true,
            isApproved: true,
            failedLoginAttempts: 0,
            isLocked: false,
            lockUntil: null,
            requireCaptcha: false,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: 'System Admin',
            email: 'admin@vendor.com',
            password: hashedPassword,
            role: 'super-admin',
            adminRole: 'super-admin',
            adminLevel: 'main',
            level: 'main',
            status: 'approved',
            isActive: true,
            isApproved: true,
            failedLoginAttempts: 0,
            isLocked: false,
            lockUntil: null,
            requireCaptcha: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    const targetDbs = ['test', 'connect_db'];

    for (const dbName of targetDbs) {
        const db = mongoose.connection.client.db(dbName);
        console.log(`\n=== Seeding into database: ${dbName} ===`);
        for (const u of adminUsers) {
            const res = await db.collection('users').updateOne(
                { email: u.email },
                { $set: u },
                { upsert: true }
            );
            console.log(`  Upserted ${u.email} into ${dbName}.users: matched=${res.matchedCount}, upserted=${res.upsertedCount}`);
            
            // Also ensure legacy/auxiliary admins collection has the record if referenced
            await db.collection('admins').updateOne(
                { email: u.email },
                { 
                    $set: {
                        name: u.name,
                        email: u.email,
                        role: u.role,
                        adminRole: u.adminRole,
                        adminLevel: u.adminLevel,
                        status: u.status,
                        isActive: u.isActive,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
        }
    }

    console.log('\nVerifying login check in both databases...');
    for (const dbName of targetDbs) {
        const db = mongoose.connection.client.db(dbName);
        for (const u of adminUsers) {
            const doc = await db.collection('users').findOne({ email: u.email });
            const match = await bcrypt.compare('admin123', doc.password);
            console.log(`[${dbName}] ${doc.email} -> ID: ${doc._id}, Role: ${doc.role}, Active: ${doc.isActive}, Password Valid: ${match}`);
        }
    }

    process.exit(0);
}

run().catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
});
