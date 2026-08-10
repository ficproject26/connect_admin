const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

async function checkAllVendors() {
    await mongoose.connect(uri);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));

    const users = await User.find({});
    const vendors = await Vendor.find({});

    console.log('=== ALL USERS IN DB ===');
    users.forEach(u => console.log(`ID: ${u._id} | Name: ${u.name || u.businessName} | Role: ${u.role} | Status: ${u.status} | Email: ${u.email}`));

    console.log('\n=== ALL VENDORS IN VENDORS COLLECTION ===');
    vendors.forEach(v => console.log(`ID: ${v._id} | Business: ${v.businessName} | Status: ${v.status} | Email: ${v.email}`));

    await mongoose.disconnect();
}

checkAllVendors().catch(console.error);
