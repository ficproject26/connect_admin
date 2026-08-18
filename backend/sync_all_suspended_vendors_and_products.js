const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB...');

        const db = mongoose.connection.db;

        // 1. Find all users/vendors whose status is Suspended/Rejected/Inactive/Deactivated
        const suspendedUsers = await db.collection('users').find({
            $or: [
                { status: { $in: ['suspended', 'Suspended', 'rejected', 'Rejected', 'inactive', 'Inactive', 'deactivated', 'Deactivated'] } },
                { isActive: false }
            ]
        }).toArray();

        const suspendedVendorDocs = await db.collection('vendors').find({
            $or: [
                { status: { $in: ['suspended', 'Suspended', 'rejected', 'Rejected', 'inactive', 'Inactive', 'deactivated', 'Deactivated'] } },
                { isActive: false }
            ]
        }).toArray();

        console.log(`Found ${suspendedUsers.length} suspended users and ${suspendedVendorDocs.length} suspended vendor docs.`);

        const validObjectIds = [];
        const stringKeys = [];

        [...suspendedUsers, ...suspendedVendorDocs].forEach(v => {
            if (v._id) {
                const idStr = v._id.toString();
                stringKeys.push(idStr);
                if (mongoose.Types.ObjectId.isValid(idStr)) validObjectIds.push(new mongoose.Types.ObjectId(idStr));
            }
            if (v.registrationId) stringKeys.push(v.registrationId.toString());
            if (v.vendorId) stringKeys.push(v.vendorId.toString());
            if (v.primaryBusinessId) {
                const pIdStr = v.primaryBusinessId.toString();
                stringKeys.push(pIdStr);
                if (mongoose.Types.ObjectId.isValid(pIdStr)) validObjectIds.push(new mongoose.Types.ObjectId(pIdStr));
            }
            if (Array.isArray(v.businesses)) {
                v.businesses.forEach(b => {
                    if (b._id) {
                        const bIdStr = b._id.toString();
                        stringKeys.push(bIdStr);
                        if (mongoose.Types.ObjectId.isValid(bIdStr)) validObjectIds.push(new mongoose.Types.ObjectId(bIdStr));
                    }
                });
            }
            if (v.email) stringKeys.push(v.email.toLowerCase().trim());
            if (v.phone) stringKeys.push(v.phone.replace(/\D/g, ''));
            if (v.mobileNumber) stringKeys.push(v.mobileNumber.replace(/\D/g, ''));
            if (v.businessName) stringKeys.push(v.businessName.toLowerCase().trim());
            if (v.name) stringKeys.push(v.name.toLowerCase().trim());
        });

        console.log('Synchronizing products for all suspended keys...');

        const rawProductColl = db.collection('products');
        const updateRes = await rawProductColl.updateMany(
            {
                $or: [
                    { vendorId: { $in: [...validObjectIds, ...stringKeys] } },
                    { vendor: { $in: [...validObjectIds, ...stringKeys] } },
                    { businessId: { $in: [...validObjectIds, ...stringKeys] } },
                    { vendorEmail: { $in: stringKeys.map(e => e.toLowerCase()) } },
                    { vendorPhone: { $in: stringKeys } },
                    { vendorName: { $in: stringKeys } }
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

        console.log('Products update result:', updateRes);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
