const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        const db = mongoose.connection.db;

        const user = await db.collection('users').findOne({ email: 'hrblr@forgeindiaconnect.com' });
        console.log('Forge User document:', {
            _id: user?._id,
            email: user?.email,
            businessName: user?.businessName,
            status: user?.status,
            isActive: user?.isActive,
            isApproved: user?.isApproved,
            rejectionReason: user?.rejectionReason,
            businesses: user?.businesses?.map(b => ({ name: b.businessName || b.name, status: b.status, isActive: b.isActive }))
        });

        // Fetch products matching vendor
        const products = await db.collection('products').find({
            $or: [
                { vendorId: user?._id },
                { vendorId: user?._id?.toString() },
                { vendorId: user?.primaryBusinessId },
                { vendorId: user?.primaryBusinessId?.toString() },
                { vendorEmail: 'hrblr@forgeindiaconnect.com' }
            ]
        }).toArray();

        console.log('Forge Products in MongoDB:', products.map(p => ({
            _id: p._id,
            name: p.name || p.title,
            vendorId: p.vendorId,
            isActive: p.isActive,
            isAvailable: p.isAvailable,
            vendorStatus: p.vendorStatus,
            isVendorSuspended: p.isVendorSuspended
        })));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
