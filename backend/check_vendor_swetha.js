const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function checkVendor() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const userVendor = await db.collection('users').findOne({ email: 'swetha@gmail.com' });
    const docVendor = await db.collection('vendors').findOne({ email: 'swetha@gmail.com' });
    const pinDoc = await db.collection('pincodes').findOne({ code: '636112' });

    console.log('=== USER COLLECTION RECORD FOR swetha@gmail.com ===');
    console.log(JSON.stringify(userVendor, null, 2));

    console.log('=== VENDORS COLLECTION RECORD FOR swetha@gmail.com ===');
    console.log(JSON.stringify(docVendor, null, 2));

    console.log('=== PINCODE RECORD FOR 636112 ===');
    console.log(JSON.stringify(pinDoc, null, 2));

    await mongoose.disconnect();
}

checkVendor().catch(console.error);
