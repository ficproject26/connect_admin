const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';
        await mongoose.connect(dbURI);
        console.log('MongoDB Connected...');

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
    } catch (err) {
        console.error(err.message);
        process.exit(1);
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
            db.collection('vendors').createIndex({ status: 1, isActive: 1 }, { background: true }),
            db.collection('vendors').createIndex({ category: 1 }, { background: true }),
            db.collection('vendors').createIndex({ branchId: 1 }, { background: true }),
            db.collection('vendors').createIndex({ registrationId: 1 }, { background: true }),
            db.collection('vendors').createIndex({ joiningType: 1 }, { background: true }),
            db.collection('orders').createIndex({ vendorId: 1, status: 1 }, { background: true }),
            db.collection('orders').createIndex({ vendor_id: 1, status: 1 }, { background: true }),
            db.collection('orders').createIndex({ createdAt: -1 }, { background: true }),
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
