const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

async function syncProductStatuses() {
    await mongoose.connect(uri);
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));

    const users = await User.find({});
    const vendors = await Vendor.find({});
    const products = await Product.find({});

    console.log(`Initial total products: ${products.length}`);

    const suspendedVendors = [...users, ...vendors].filter(v => {
        const st = (v.status || '').toLowerCase();
        return st === 'suspended' || st === 'rejected' || st === 'inactive' || v.isActive === false;
    });

    console.log(`Found ${suspendedVendors.length} suspended/inactive vendors.`);

    let updatedCount = 0;

    for (const vendor of suspendedVendors) {
        const vIdStr = vendor._id.toString();
        const vPrefix = vIdStr.substring(0, 18);
        const idRegex = new RegExp('^' + vPrefix);

        const query = {
            $or: [
                { vendorId: vendor._id },
                { vendorId: idRegex },
                { vendorEmail: vendor.email },
                { vendorPhone: vendor.phone }
            ]
        };

        if (vendor.email) {
            query.$or.push({ vendorEmail: vendor.email.toLowerCase().trim() });
        }

        const res = await Product.updateMany(
            query,
            { $set: { vendorStatus: 'suspended', isVendorSuspended: true, isSuspended: true, isActive: false } }
        );

        console.log(`Updated ${res.modifiedCount} products for vendor ${vendor.name || vendor.businessName} (${vIdStr})`);
        updatedCount += res.modifiedCount;
    }

    // Also: if ALL vendors are suspended, mark ALL products in MongoDB as vendorStatus: 'suspended'
    const activeApprovedVendors = users.filter(u => {
        const st = (u.status || '').toLowerCase();
        return ['vendor', 'Vendor', 'merchant', 'Merchant'].includes(u.role) && (st === 'approved' || st === 'active') && u.isActive !== false;
    });

    if (activeApprovedVendors.length === 0) {
        console.log('Zero active approved vendors found in database! Marking ALL products in DB as suspended...');
        const resAll = await Product.updateMany(
            {},
            { $set: { vendorStatus: 'suspended', isVendorSuspended: true, isSuspended: true, isActive: false } }
        );
        console.log(`Marked all ${resAll.modifiedCount} products in DB as suspended.`);
    }

    await mongoose.disconnect();
}

syncProductStatuses().catch(console.error);
