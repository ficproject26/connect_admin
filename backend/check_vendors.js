const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

async function checkVendors() {
    await mongoose.connect(uri);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

    const allUsers = await User.find({});
    const vendorsCol = await Vendor.find({});
    const products = await Product.find({});

    console.log('=== USERS WITH STATUS ===');
    allUsers.forEach(v => console.log(v._id.toString(), '| name:', v.name || v.businessName, '| role:', v.role, '| status:', v.status, '| isActive:', v.isActive));
    
    console.log('\n=== VENDORS COLLECTION ===');
    vendorsCol.forEach(v => console.log(v._id.toString(), '| name:', v.businessName, '| status:', v.status));
    
    console.log('\n=== PRODUCTS & VENDOR STATUS ===');
    products.forEach(p => {
        const vId = p.vendorId ? p.vendorId.toString() : '';
        const vU = allUsers.find(v => v._id.toString() === vId);
        const vC = vendorsCol.find(v => v._id.toString() === vId);
        console.log((p.name || '').padEnd(25), '| vendorId:', vId, '| userRole:', vU ? vU.role : 'N/A', '| userStatus:', vU ? vU.status : 'N/A', '| userIsActive:', vU ? vU.isActive : 'N/A', '| vendorColStatus:', vC ? vC.status : 'N/A');
    });

    await mongoose.disconnect();
}

checkVendors().catch(console.error);
