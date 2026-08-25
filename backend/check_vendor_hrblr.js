const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function checkVendor() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const userVendor = await db.collection('users').findOne({ email: 'hrblr@forgeindiaconnect.com' });
    const docVendor = await db.collection('vendors').findOne({ email: 'hrblr@forgeindiaconnect.com' });

    console.log('=== USER COLLECTION VENDOR RECORD ===');
    console.log(JSON.stringify(userVendor, null, 2));

    console.log('=== VENDORS COLLECTION VENDOR RECORD ===');
    console.log(JSON.stringify(docVendor, null, 2));

    await mongoose.disconnect();
}

checkVendor().catch(console.error);
