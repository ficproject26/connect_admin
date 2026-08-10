const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

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
