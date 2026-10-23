const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI ;
    console.log('Connecting to MongoDB cluster...');
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const adminUsers = [
        {
            name: 'Super Admin',
            email: 'admin@example.com',
            password: hashedPassword,
            passwordHash: hashedPassword,
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
            name: 'Dhanush',
            email: 'dhanush.antigraviity@gmail.com',
            phone: '6379068721',
            password: hashedPassword,
            passwordHash: hashedPassword,
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
            passwordHash: hashedPassword,
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
            name: 'Dhanu',
            email: 'dhanushiyasri1924@gmail.com',
            phone: '8765432134',
            password: hashedPassword,
            passwordHash: '$2a$10$ZZyYG6oAjWS2hSaL9nAUYur8mtArFNMepSckvevMImNketPuz2i5O',
            role: 'admin',
            adminRole: 'branch-admin',
            adminLevel: 'state',
            level: 'state',
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
            name: 'Dinesh',
            email: 'dinesh12@gmail.com',
            phone: '8493844583',
            password: hashedPassword,
            passwordHash: '$2b$10$fNLOQ.ks6bkYCoU0zQbmYeGyaafelAXv2KQfQjOwrdqP7qq3bW6yS',
            role: 'admin',
            adminRole: 'state-admin',
            adminLevel: 'state',
            level: 'state',
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
            name: 'Akash Kumar',
            email: 'akash@gmail.com',
            password: hashedPassword,
            passwordHash: hashedPassword,
            role: 'admin',
            adminRole: 'state-admin',
            adminLevel: 'state',
            level: 'state',
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
            name: 'Aakash Kumar',
            email: 'aakash@gmail.com',
            password: hashedPassword,
            passwordHash: hashedPassword,
            role: 'admin',
            adminRole: 'state-admin',
            adminLevel: 'state',
            level: 'state',
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
            name: 'Dhanush Tamilarasan',
            email: 'hi@gmail.com',
            phone: '6379068725',
            password: hashedPassword,
            passwordHash: '$2b$10$Wh8BpzCDbNz74VZ3civJVexSZHy0.1tSWPOIY5VhT0fmotysEQ9kK',
            role: 'admin',
            adminRole: 'state-admin',
            adminLevel: 'state',
            level: 'pincode',
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
            name: 'North District Admin',
            email: 'north@example.com',
            password: hashedPassword,
            passwordHash: hashedPassword,
            role: 'admin',
            adminRole: 'district-admin',
            adminLevel: 'district',
            level: 'district',
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
