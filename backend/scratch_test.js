const mongoose = require('mongoose');
const User = require('./models/User');
const Vendor = require('./models/Vendor');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB successfully');
        
        const userVendors = await User.find({ role: { $in: ['Vendor', 'vendor'] } });
        console.log('User-based Vendors count:', userVendors.length);
        console.log('User-based Vendors details:', userVendors.map(u => ({ id: u._id, name: u.name, businessName: u.businessName, role: u.role, status: u.status })));
        
        const legacyVendors = await Vendor.find();
        console.log('Legacy Vendors count:', legacyVendors.length);
        console.log('Legacy Vendors details:', legacyVendors.map(v => ({ id: v._id, businessName: v.businessName, status: v.status })));
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
