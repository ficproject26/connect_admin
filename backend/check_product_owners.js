const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

async function checkProductOwners() {
    await mongoose.connect(uri);
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const products = await Product.find({});
    const users = await User.find({});

    console.log('=== PRODUCT VENDOR IDS ===');
    const vIds = [...new Set(products.map(p => p.vendorId ? p.vendorId.toString() : 'NO_ID'))];
    vIds.forEach(id => {
        const u = users.find(user => user._id.toString() === id || user._id.toString().startsWith(id.substring(0, 20)));
        console.log(`VendorId in product: ${id} => Found User: ${u ? `${u.name || u.businessName} (Role: ${u.role}, Status: ${u.status})` : 'NOT FOUND IN USER COLLECTION'}`);
    });

    await mongoose.disconnect();
}

checkProductOwners().catch(console.error);
