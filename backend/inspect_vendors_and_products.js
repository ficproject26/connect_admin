const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

async function inspectMultiVendor() {
    await mongoose.connect(uri);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

    const users = await User.find({
        $or: [
            { role: { $in: ['vendor', 'Vendor'] } },
            { vendorType: { $exists: true } },
            { businesses: { $exists: true, $not: { $size: 0 } } }
        ]
    }).lean();

    const vendors = await Vendor.find().lean();

    console.log(`=== VENDORS IN USER COLLECTION (${users.length}) ===`);
    users.forEach((u, i) => {
        console.log(`[${i+1}] ID: ${u._id} | RegID: ${u.registrationId || 'N/A'} | Name: ${u.businessName || u.name} | Email: ${u.email} | Status: ${u.status} | isActive: ${u.isActive}`);
        if (Array.isArray(u.businesses)) {
            console.log(`    Sub-Businesses (${u.businesses.length}):`);
            u.businesses.forEach(b => {
                console.log(`      - Biz ID: ${b._id || 'N/A'} | Name: ${b.businessName || b.name} | Category: ${b.category || b.vendorType} | Status: ${b.status} | isActive: ${b.isActive}`);
            });
        }
    });

    console.log(`\n=== VENDORS IN VENDOR COLLECTION (${vendors.length}) ===`);
    vendors.forEach((v, i) => {
        console.log(`[${i+1}] ID: ${v._id} | RegID: ${v.registrationId || 'N/A'} | Name: ${v.businessName || v.name} | Status: ${v.status}`);
    });

    const products = await Product.find().lean();
    console.log(`\n=== PRODUCTS IN PRODUCT COLLECTION (${products.length}) ===`);
    products.forEach((p, i) => {
        console.log(`[${i+1}] ID: ${p._id} | Name: ${p.name || p.title} | MainCat/SubNav: ${p.subNavbarCategory || p.mainCategory} | Category: ${p.category} | VendorID: ${p.vendorId} | VendorEmail: ${p.vendorEmail} | BizID: ${p.businessId} | BizName: ${p.businessName} | Status: ${p.status || p.vendorStatus} | isActive: ${p.isActive}`);
    });

    await mongoose.disconnect();
}

inspectMultiVendor().catch(console.error);
