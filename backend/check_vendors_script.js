const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function check() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const userVendors = await db.collection('users').find({
        role: { $in: ['vendor', 'Vendor', 'merchant', 'Merchant'] }
    }).toArray();

    const vendorDocs = await db.collection('vendors').find({}).toArray();
    const allUsers = await db.collection('users').find({}).toArray();

    console.log('=== USER VENDORS COUNT:', userVendors.length);
    console.log('=== USER VENDORS:', JSON.stringify(userVendors, null, 2));

    console.log('=== VENDOR DOCS COUNT:', vendorDocs.length);
    console.log('=== VENDOR DOCS:', JSON.stringify(vendorDocs, null, 2));

    console.log('=== ALL USERS COUNT:', allUsers.length);
    console.log('=== ALL USERS:', JSON.stringify(allUsers.map(u => ({ id: u._id, name: u.name, role: u.role, email: u.email, status: u.status })), null, 2));

    await mongoose.disconnect();
}

check().catch(console.error);
