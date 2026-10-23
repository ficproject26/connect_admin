const mongoose = require('mongoose');
require('dotenv').config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/connect_db?retryWrites=true&w=majority';

async function checkVendors() {
    await mongoose.connect(uri);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));

    const allUsers = await User.find({});
    const vendorsCol = await Vendor.find({});

    console.log('=== ALL USERS IN DB (' + allUsers.length + ') ===');
    allUsers.forEach(v => {
        console.log(`ID: ${v._id} | Name: ${v.name || v.businessName} | Role: ${v.role} | Status: ${v.status} | Email: ${v.email} | RegId: ${v.registrationId}`);
    });
    
    console.log('\n=== ALL VENDORS COLLECTION IN DB (' + vendorsCol.length + ') ===');
    vendorsCol.forEach(v => {
        console.log(`ID: ${v._id} | Business: ${v.businessName} | Status: ${v.status} | Email: ${v.email}`);
    });

    await mongoose.disconnect();
}

checkVendors().catch(console.error);
