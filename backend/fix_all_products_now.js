const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB...');
        const db = mongoose.connection.db;

        // 1. Fetch all suspended vendor users
        const suspendedUsers = await db.collection('users').find({
            $or: [
                { status: { $in: ['suspended', 'Suspended', 'rejected', 'Rejected', 'inactive', 'Inactive', 'deactivated', 'Deactivated', 'blocked', 'Blocked'] } },
                { isActive: false },
                { isApproved: false }
            ]
        }).toArray();

        const suspendedVendors = await db.collection('vendors').find({
            $or: [
                { status: { $in: ['suspended', 'Suspended', 'rejected', 'Rejected', 'inactive', 'Inactive', 'deactivated', 'Deactivated', 'blocked', 'Blocked'] } },
                { isActive: false }
            ]
        }).toArray();

        console.log(`Found ${suspendedUsers.length} suspended users and ${suspendedVendors.length} suspended vendor docs.`);

        const allSuspendedIds = new Set();
        const allSuspendedEmails = new Set();
        const allSuspendedPhones = new Set();
        const allSuspendedNames = new Set();

        [...suspendedUsers, ...suspendedVendors].forEach(v => {
            if (v._id) allSuspendedIds.add(v._id.toString());
            if (v.registrationId) allSuspendedIds.add(v.registrationId.toString());
            if (v.vendorId) allSuspendedIds.add(v.vendorId.toString());
            if (v.primaryBusinessId) allSuspendedIds.add(v.primaryBusinessId.toString());

            if (Array.isArray(v.businesses)) {
                v.businesses.forEach(b => {
                    if (b._id) allSuspendedIds.add(b._id.toString());
                    if (b.businessName) allSuspendedNames.add(b.businessName.toLowerCase().trim());
                    if (b.name) allSuspendedNames.add(b.name.toLowerCase().trim());
                });
            }

            if (v.email) allSuspendedEmails.add(v.email.toLowerCase().trim());
            if (v.phone) allSuspendedPhones.add(v.phone.replace(/\D/g, ''));
            if (v.mobileNumber) allSuspendedPhones.add(v.mobileNumber.replace(/\D/g, ''));
            if (v.businessName) allSuspendedNames.add(v.businessName.toLowerCase().trim());
            if (v.name) allSuspendedNames.add(v.name.toLowerCase().trim());
        });

        const suspendedIdList = Array.from(allSuspendedIds);
        console.log('All suspended IDs across users and businesses:', suspendedIdList);

        // Update products matching any suspended ID
        const updateRes = await db.collection('products').updateMany(
            {
                $or: [
                    { vendorId: { $in: suspendedIdList } },
                    { vendor: { $in: suspendedIdList } },
                    { businessId: { $in: suspendedIdList } },
                    { vendorEmail: { $in: Array.from(allSuspendedEmails) } },
                    { vendorPhone: { $in: Array.from(allSuspendedPhones) } },
                    { vendorName: { $in: Array.from(allSuspendedNames) } }
                ]
            },
            {
                $set: {
                    isActive: false,
                    isAvailable: false,
                    vendorStatus: 'Suspended',
                    isVendorSuspended: true,
                    isSuspended: true
                }
            }
        );

        console.log('Updated products count:', updateRes);

        // Re-verify products currently active in DB
        const remainingActiveProducts = await db.collection('products').find({
            isActive: { $ne: false },
            isAvailable: { $ne: false }
        }).toArray();

        console.log(`Remaining active products in database: ${remainingActiveProducts.length}`);
        remainingActiveProducts.forEach(p => {
            console.log(`Active product: ID=${p._id}, name=${p.name || p.title}, vendorId=${p.vendorId}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
