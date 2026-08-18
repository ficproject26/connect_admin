const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');
const Vendor = require('./models/Vendor');
const Product = require('./models/Product');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB...');

        const db = mongoose.connection.db;

        // Query users with name/businessName/email/phone containing 'Forge' or 'ihgfc' or 'VND-VEN-FIC-2026-V004'
        const users = await db.collection('users').find({
            $or: [
                { name: { $regex: /forge|ihgfc/i } },
                { businessName: { $regex: /forge|ihgfc/i } },
                { registrationId: { $regex: /V004/i } },
                { email: { $regex: /forge|ihgfc/i } }
            ]
        }).toArray();

        const vendors = await db.collection('vendors').find({
            $or: [
                { name: { $regex: /forge|ihgfc/i } },
                { businessName: { $regex: /forge|ihgfc/i } },
                { registrationId: { $regex: /V004/i } },
                { email: { $regex: /forge|ihgfc/i } }
            ]
        }).toArray();

        console.log('Users matching Forge:', users);
        console.log('Vendors matching Forge:', vendors);

        // Find products owned by these vendor IDs
        const vendorIds = [...users.map(u => u._id), ...vendors.map(v => v._id)];
        const products = await db.collection('products').find({
            $or: [
                { vendorId: { $in: vendorIds } },
                { vendorId: { $in: vendorIds.map(id => id.toString()) } }
            ]
        }).toArray();

        console.log('Products for Forge vendor:', products);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
