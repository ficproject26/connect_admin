const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function testEnrich() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const User = require('./models/User');
    const userDoc = await User.findOne({ email: 'hrblr@forgeindiaconnect.com' }).lean();

    if (userDoc) {
        let vObj = { ...userDoc };

        vObj.phone = vObj.mobileNumber || vObj.mobileContact || vObj.mobile || vObj.phone || vObj.phoneNumber || vObj.contactNumber || vObj.telephone || vObj.contactPersonPhone || vObj.mobileNo || vObj.phoneNo || '—';
        vObj.mobileNumber = vObj.mobileNumber || (vObj.phone !== '—' ? vObj.phone : '');

        let city = vObj.city || vObj.district || '';
        let state = vObj.state || '';
        let pin = vObj.pincode || vObj.postalCode || '';
        let addr = vObj.address || vObj.fullAddress || vObj.businessAddress || '';

        if (!city || !state || city === '—' || state === '—') {
            if (addr && addr.includes(',')) {
                const parts = addr.split(',').map(p => p.trim());
                if ((!city || city === '—') && parts[0] && !parts[0].match(/^\d+$/)) city = parts[0];
                if ((!state || state === '—') && parts[1]) state = parts[1].replace(/\d{6}/g, '').trim();
            }
        }

        vObj.city = city || '—';
        vObj.district = city || '—';
        vObj.state = state || '—';
        vObj.pincode = pin || '—';

        console.log('=== ENRICHED VENDOR OBJECT ===');
        console.log('Name:', vObj.businessName || vObj.name);
        console.log('Email:', vObj.email);
        console.log('Phone:', vObj.phone);
        console.log('Mobile Number:', vObj.mobileNumber);
        console.log('City:', vObj.city);
        console.log('State:', vObj.state);
        console.log('Pincode:', vObj.pincode);
        console.log('Address:', vObj.address);
    }

    await mongoose.disconnect();
}

testEnrich().catch(console.error);
