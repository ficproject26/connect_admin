const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        const db = mongoose.connection.db;

        const user = await db.collection('users').findOne({ email: 'hrblr@forgeindiaconnect.com' });
        console.log('User status:', user.status, 'isActive:', user.isActive);
        console.log('Businesses:', JSON.stringify(user.businesses, null, 2));

        const products = await db.collection('products').find({
            $or: [
                { vendorId: user._id },
                { vendorId: user._id.toString() },
                { vendorId: user.primaryBusinessId },
                { vendorId: user.primaryBusinessId.toString() },
                { businessId: '6a741c71f6229f696b527e3a' },
                { vendorEmail: 'hrblr@forgeindiaconnect.com' }
            ]
        }).toArray();

        console.log('Found products:', products.map(p => ({
            _id: p._id,
            name: p.name || p.title,
            vendorId: p.vendorId,
            businessId: p.businessId,
            vendorStatus: p.vendorStatus,
            isActive: p.isActive,
            isAvailable: p.isAvailable,
            isVendorSuspended: p.isVendorSuspended,
            businessStatus: p.businessStatus,
            businessIsActive: p.businessIsActive
        })));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
