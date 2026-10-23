require('dotenv').config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/connect_db?retryWrites=true&w=majority';

async function checkProducts() {
    await mongoose.connect(uri);
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));

    const products = await Product.find({});
    const users = await User.find({});
    const vendors = await Vendor.find({});

    console.log(`=== TOTAL PRODUCTS IN DB: ${products.length} ===`);
    products.forEach((p, i) => {
        console.log(`${i+1}. ID: ${p._id} | Name: ${p.name} | VendorId: ${p.vendorId} | VendorName: ${p.vendorName} | VendorStatus: ${p.vendorStatus} | isSuspended: ${p.isSuspended} | isVendorSuspended: ${p.isVendorSuspended} | isActive: ${p.isActive}`);
    });

    console.log(`\n=== SUSPENDED USERS/VENDORS IN DB ===`);
    users.filter(u => ['suspended', 'inactive', 'rejected'].includes((u.status || '').toLowerCase())).forEach(u => {
        console.log(`User ID: ${u._id} | Name: ${u.name || u.businessName} | Role: ${u.role} | Status: ${u.status}`);
    });
    vendors.filter(v => ['suspended', 'inactive', 'rejected'].includes((v.status || '').toLowerCase())).forEach(v => {
        console.log(`Vendor ID: ${v._id} | Business: ${v.businessName} | Status: ${v.status}`);
    });

    await mongoose.disconnect();
}

checkProducts().catch(console.error);
