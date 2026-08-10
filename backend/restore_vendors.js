const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

async function restoreVendors() {
    await mongoose.connect(uri);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

    const resUsers = await User.updateMany(
        { role: { $in: ['vendor', 'Vendor', 'merchant', 'Merchant'] } },
        { $set: { status: 'Approved', isActive: true, isApproved: true } }
    );
    console.log(`Restored ${resUsers.modifiedCount} vendors to Approved/Active.`);

    const resProds = await Product.updateMany(
        {},
        { $set: { vendorStatus: 'approved', isVendorSuspended: false, isSuspended: false, isActive: true, isAvailable: true } }
    );
    console.log(`Restored ${resProds.modifiedCount} products to Approved/Active.`);

    await mongoose.disconnect();
}

restoreVendors().catch(console.error);
