const mongoose = require('mongoose');

const connectDB = async () => {
    let rawURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://Connect-app:Connect123@cluster0.fzj1k5l.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';
    if (rawURI.includes('/connect_db')) {
        rawURI = rawURI.replace('/connect_db', '/test');
    }
    const dbURI = rawURI;

    const options = {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        family: 4
    };

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            attempts++;
            await mongoose.connect(dbURI, options);
            console.log('MongoDB Connected successfully...');

            // Pre-register all models to prevent MissingSchemaError on populates
            try {
                require('../models/User');
                require('../models/Pincode');
                require('../models/Branch');
                require('../models/Vendor');
                require('../models/AgentTarget');
                require('../models/AgentActivity');
                require('../models/Customer');
                require('../models/Order');
            } catch (mErr) {
                console.error('Model registration warning:', mErr.message);
            }

            await ensureIndexes();
            return;
        } catch (err) {
            console.error(`[DB] Connection attempt ${attempts}/${maxAttempts} failed: ${err.message}`);
            if (attempts >= maxAttempts) {
                console.error('Fatal: MongoDB connection failed after maximum retries.');
                process.exit(1);
            }
            await new Promise(res => setTimeout(res, 2000));
        }
    }
};

const ensureIndexes = async () => {
    try {
        const db = mongoose.connection.db;
        if (!db) return;

        // Background non-blocking index creation
        await Promise.allSettled([
            db.collection('users').createIndex({ role: 1, status: 1, isActive: 1 }, { background: true }),
            db.collection('users').createIndex({ role: 1, level: 1 }, { background: true }),
            db.collection('users').createIndex({ branchId: 1 }, { background: true }),
            db.collection('users').createIndex({ registrationId: 1 }, { background: true }),
            db.collection('users').createIndex({ email: 1 }, { background: true }),
            db.collection('users').createIndex({ phone: 1 }, { background: true }),
            db.collection('vendors').createIndex({ status: 1, isActive: 1 }, { background: true }),
            db.collection('vendors').createIndex({ category: 1 }, { background: true }),
            db.collection('vendors').createIndex({ branchId: 1 }, { background: true }),
            db.collection('vendors').createIndex({ registrationId: 1 }, { background: true }),
            db.collection('vendors').createIndex({ joiningType: 1 }, { background: true }),
            db.collection('products').createIndex({ isActive: 1, isAvailable: 1, createdAt: -1 }, { background: true }),
            db.collection('products').createIndex({ category: 1, subcategory: 1 }, { background: true }),
            db.collection('products').createIndex({ vendorId: 1 }, { background: true }),
            db.collection('categories').createIndex({ parentId: 1, sortOrder: 1 }, { background: true }),
            db.collection('categories').createIndex({ level: 1, isActive: 1 }, { background: true }),
            db.collection('orders').createIndex({ vendorId: 1, status: 1 }, { background: true }),
            db.collection('orders').createIndex({ vendor_id: 1, status: 1 }, { background: true }),
            db.collection('orders').createIndex({ createdAt: -1 }, { background: true }),
            db.collection('orders').createIndex({ type: 1, createdAt: -1 }, { background: true }),
            db.collection('bookings').createIndex({ vendorId: 1, status: 1 }, { background: true }),
            db.collection('bookings').createIndex({ createdAt: -1 }, { background: true }),
            db.collection('customers').createIndex({ branchId: 1, status: 1 }, { background: true }),
            db.collection('pincodes').createIndex({ code: 1 }, { background: true })
        ]);
        console.log('✅ Performance Database Indexes Ensured');
    } catch (e) {
        console.error('Index creation warning:', e.message);
    }
};

module.exports = connectDB;
