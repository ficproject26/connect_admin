const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');
const Vendor = require('./models/Vendor');
const Product = require('./models/Product');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB...');

        const db = mongoose.connection.db;

        // 1. Find all suspended users and vendors
        const suspendedUsers = await User.find({
            $or: [
                { status: { $in: ['suspended', 'Suspended', 'rejected', 'Rejected', 'inactive', 'Inactive'] } },
                { isActive: false }
            ]
        }).lean();

        const suspendedVendorDocs = await Vendor.find({
            $or: [
                { status: { $in: ['suspended', 'Suspended', 'rejected', 'Rejected', 'inactive', 'Inactive'] } },
                { isActive: false }
            ]
        }).lean();

        console.log('Suspended Users count:', suspendedUsers.length);
        console.log('Suspended Vendor docs count:', suspendedVendorDocs.length);

        const validObjectIds = [];
        const stringKeys = [];

        [...suspendedUsers, ...suspendedVendorDocs].forEach(v => {
            if (v._id) {
                const idStr = v._id.toString();
                if (mongoose.Types.ObjectId.isValid(idStr)) validObjectIds.push(new mongoose.Types.ObjectId(idStr));
                stringKeys.push(idStr);
            }
            if (v.registrationId) stringKeys.push(v.registrationId.toString());
            if (v.vendorId) stringKeys.push(v.vendorId.toString());
            if (v.email) stringKeys.push(v.email.toLowerCase().trim());
            if (v.phone) stringKeys.push(v.phone.replace(/\D/g, ''));
            if (v.businessName) stringKeys.push(v.businessName.toLowerCase().trim());
            if (v.name) stringKeys.push(v.name.toLowerCase().trim());
        });

        console.log('Valid ObjectIds for suspended vendors:', validObjectIds);
        console.log('String keys for suspended vendors:', stringKeys);

        // 2. Perform direct MongoDB collection query & update to bypass Mongoose Schema CastError
        const rawProductColl = db.collection('products');
        const rawProducts = await rawProductColl.find({}).toArray();
        console.log('Total raw products in database:', rawProducts.length);

        let updatedCount = 0;
        for (const p of rawProducts) {
            console.log(`Checking raw product: ID=${p._id}, name=${p.name || p.title}, vendorId=${p.vendorId}, vendorEmail=${p.vendorEmail}, vendorStatus=${p.vendorStatus}, isActive=${p.isActive}`);
            
            // Check if vendor matches suspended vendor
            let shouldBeSuspended = false;
            let matchReason = '';

            const pVendorIdStr = p.vendorId ? p.vendorId.toString() : '';
            const pVendorStr = p.vendor ? p.vendor.toString() : '';
            const pEmailStr = (p.vendorEmail || '').toLowerCase().trim();
            const pPhoneStr = (p.vendorPhone || '').replace(/\D/g, '');
            const pNameStr = (p.vendorName || p.brand || '').toLowerCase().trim();

            const isIdMatch = validObjectIds.some(oid => oid.toString() === pVendorIdStr || oid.toString() === pVendorStr) ||
                              stringKeys.includes(pVendorIdStr) || stringKeys.includes(pVendorStr);
            const isEmailMatch = pEmailStr && stringKeys.includes(pEmailStr);
            const isPhoneMatch = pPhoneStr && stringKeys.includes(pPhoneStr);
            const isNameMatch = pNameStr && stringKeys.includes(pNameStr);

            if (isIdMatch || isEmailMatch || isPhoneMatch || isNameMatch) {
                shouldBeSuspended = true;
                matchReason = `Matched suspended vendor keys (ID=${isIdMatch}, Email=${isEmailMatch}, Phone=${isPhoneMatch}, Name=${isNameMatch})`;
            }

            // Also query the vendor document directly
            if (!shouldBeSuspended && (pVendorIdStr || pVendorStr)) {
                const targetVendorId = pVendorIdStr || pVendorStr;
                if (mongoose.Types.ObjectId.isValid(targetVendorId)) {
                    const vUser = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(targetVendorId) });
                    const vDoc = await db.collection('vendors').findOne({ _id: new mongoose.Types.ObjectId(targetVendorId) });
                    const v = vUser || vDoc;
                    if (v) {
                        const st = (v.status || '').toLowerCase();
                        if (['suspended', 'rejected', 'inactive'].includes(st) || v.isActive === false) {
                            shouldBeSuspended = true;
                            matchReason = `Associated Vendor ${v.name || v.businessName} has status="${v.status}", isActive=${v.isActive}`;
                        }
                    }
                }
            }

            if (shouldBeSuspended) {
                console.log(`==> SUSPENDING product ${p._id} (${p.name || p.title}): ${matchReason}`);
                await rawProductColl.updateOne(
                    { _id: p._id },
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
                updatedCount++;
            }
        }

        console.log(`Successfully updated ${updatedCount} products for suspended vendors.`);
        process.exit(0);
    } catch (e) {
        console.error('Error in script:', e);
        process.exit(1);
    }
};

run();
