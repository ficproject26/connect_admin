const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

async function syncAllExistingProducts() {
    console.log('=== SYNCING ALL EXISTING PRODUCT/SERVICE/JOB RECORDS IN MONGO DB ===');
    await mongoose.connect(uri);

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

    const users = await User.find().lean();
    const vendors = await Vendor.find().lean();
    const products = await Product.find();

    console.log(`Found ${products.length} products to inspect & sync.`);

    let updatedCount = 0;

    for (const p of products) {
        let changed = false;

        // 1. Ensure isActive and isAvailable default to true if undefined/null
        if (p.isActive === undefined || p.isActive === null) {
            p.isActive = true;
            changed = true;
        }
        if (p.isAvailable === undefined || p.isAvailable === null) {
            p.isAvailable = true;
            changed = true;
        }

        const pVendorId = p.vendorId ? p.vendorId.toString() : '';
        const pVendorEmail = (p.vendorEmail || '').toLowerCase().trim();
        const pVendorPhone = (p.vendorPhone || '').replace(/\D/g, '');
        const pVendorName = (p.vendorName || p.brand || '').toLowerCase().trim();

        let matchedUser = users.find(u => {
            const uId = u._id ? u._id.toString() : '';
            const uRegId = u.registrationId ? u.registrationId.toString() : '';
            const uVendId = u.vendorId ? u.vendorId.toString() : '';
            const uEmail = (u.email || '').toLowerCase().trim();
            const uPhone = (u.phone || '').replace(/\D/g, '');
            const uBizName = (u.businessName || u.name || '').toLowerCase().trim();

            if (pVendorId && (uId === pVendorId || uRegId === pVendorId || uVendId === pVendorId || (uId.length >= 16 && pVendorId.startsWith(uId.substring(0, 16))))) return true;
            if (pVendorEmail && uEmail === pVendorEmail) return true;
            if (pVendorPhone && uPhone === pVendorPhone) return true;
            if (pVendorName && uBizName === pVendorName) return true;
            return false;
        });

        if (!matchedUser) {
            const matchedVendDoc = vendors.find(v => {
                const vId = v._id ? v._id.toString() : '';
                const vRegId = v.registrationId ? v.registrationId.toString() : '';
                const vEmail = (v.email || '').toLowerCase().trim();
                const vPhone = (v.phone || '').replace(/\D/g, '');
                const vBizName = (v.businessName || v.name || '').toLowerCase().trim();

                if (pVendorId && (vId === pVendorId || vRegId === pVendorId)) return true;
                if (pVendorEmail && vEmail === pVendorEmail) return true;
                if (pVendorPhone && vPhone === pVendorPhone) return true;
                if (pVendorName && vBizName === pVendorName) return true;
                return false;
            });
            if (matchedVendDoc) matchedUser = matchedVendDoc;
        }

        if (matchedUser) {
            const vStatus = (matchedUser.status || '').toLowerCase().trim();
            const isVApproved = (vStatus === 'approved' || vStatus === 'active') && matchedUser.isActive !== false;
            
            if (p.vendorStatus !== vStatus) {
                p.vendorStatus = vStatus;
                changed = true;
            }
            if (p.isVendorSuspended !== !isVApproved) {
                p.isVendorSuspended = !isVApproved;
                changed = true;
            }
            if (!p.vendorEmail && matchedUser.email) {
                p.vendorEmail = matchedUser.email;
                changed = true;
            }
            if (!p.vendorPhone && (matchedUser.phone || matchedUser.mobileNumber)) {
                p.vendorPhone = matchedUser.phone || matchedUser.mobileNumber;
                changed = true;
            }
            if (!p.vendorName && (matchedUser.businessName || matchedUser.name)) {
                p.vendorName = matchedUser.businessName || matchedUser.name;
                changed = true;
            }

            // Sync Business Outlet status if matched
            if (Array.isArray(matchedUser.businesses)) {
                const pBizId = p.businessId ? p.businessId.toString() : '';
                const pBizName = (p.businessName || p.subNavbarCategory || '').toLowerCase().trim();

                const matchedBiz = matchedUser.businesses.find(b => {
                    const bId = b._id ? b._id.toString() : '';
                    const bName = (b.businessName || b.name || '').toLowerCase().trim();
                    if (pBizId && bId === pBizId) return true;
                    if (pBizName && bName === pBizName) return true;
                    return false;
                });

                if (matchedBiz) {
                    const bStatus = (matchedBiz.status || '').toLowerCase().trim();
                    const isBActive = (bStatus === 'active' || bStatus === 'approved') && matchedBiz.isActive !== false;
                    if (p.businessStatus !== bStatus) {
                        p.businessStatus = bStatus;
                        changed = true;
                    }
                    if (p.businessIsActive !== isBActive) {
                        p.businessIsActive = isBActive;
                        changed = true;
                    }
                    if (!p.businessId && matchedBiz._id) {
                        p.businessId = matchedBiz._id;
                        changed = true;
                    }
                    if (!p.businessName && (matchedBiz.businessName || matchedBiz.name)) {
                        p.businessName = matchedBiz.businessName || matchedBiz.name;
                        changed = true;
                    }
                }
            }
        }

        if (changed) {
            await p.save();
            updatedCount++;
        }
    }

    console.log(`Successfully synced ${updatedCount} products with clean vendor & business metadata.`);
    await mongoose.disconnect();
}

syncAllExistingProducts().catch(console.error);
