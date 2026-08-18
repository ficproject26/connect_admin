const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

async function syncAllProductsComprehensive() {
    console.log('=== COMPREHENSIVE PRODUCT VENDOR SYNC ===');
    await mongoose.connect(uri);

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

    const users = await User.find().lean();
    const vendors = await Vendor.find().lean();
    const products = await Product.find();

    console.log(`Found ${products.length} products to sync.`);

    let updatedCount = 0;

    for (const p of products) {
        let changed = false;

        const pVendorId = p.vendorId ? p.vendorId.toString() : '';
        const pBusinessId = p.businessId ? p.businessId.toString() : '';
        const pVendorEmail = (p.vendorEmail || '').toLowerCase().trim();
        const pVendorPhone = (p.vendorPhone || '').replace(/\D/g, '');
        const pVendorName = (p.vendorName || p.brand || '').toLowerCase().trim();

        let matchedVendor = users.find(u => {
            const uIds = new Set();
            if (u._id) uIds.add(u._id.toString());
            if (u.registrationId) uIds.add(u.registrationId.toString());
            if (u.vendorId) uIds.add(u.vendorId.toString());
            if (u.primaryBusinessId) uIds.add(u.primaryBusinessId.toString());
            if (Array.isArray(u.businesses)) {
                u.businesses.forEach(b => {
                    if (b._id) uIds.add(b._id.toString());
                });
            }

            const uEmail = (u.email || '').toLowerCase().trim();
            const uPhone = (u.phone || u.mobileNumber || '').replace(/\D/g, '');
            const uBizName = (u.businessName || u.name || '').toLowerCase().trim();

            if (pVendorId && uIds.has(pVendorId)) return true;
            if (pBusinessId && uIds.has(pBusinessId)) return true;
            if (pVendorId && uIds.size > 0 && Array.from(uIds).some(id => id.length >= 16 && pVendorId.startsWith(id.substring(0, 16)))) return true;
            if (pVendorEmail && uEmail === pVendorEmail) return true;
            if (pVendorPhone && uPhone === pVendorPhone) return true;
            if (pVendorName && uBizName === pVendorName) return true;
            return false;
        });

        if (!matchedVendor) {
            matchedVendor = vendors.find(v => {
                const vIds = new Set();
                if (v._id) vIds.add(v._id.toString());
                if (v.registrationId) vIds.add(v.registrationId.toString());
                if (v.vendorId) vIds.add(v.vendorId.toString());
                if (Array.isArray(v.businesses)) {
                    v.businesses.forEach(b => {
                        if (b._id) vIds.add(b._id.toString());
                    });
                }

                const vEmail = (v.email || '').toLowerCase().trim();
                const vPhone = (v.phone || v.mobileNumber || '').replace(/\D/g, '');
                const vBizName = (v.businessName || v.name || '').toLowerCase().trim();

                if (pVendorId && vIds.has(pVendorId)) return true;
                if (pBusinessId && vIds.has(pBusinessId)) return true;
                if (pVendorEmail && vEmail === pVendorEmail) return true;
                if (pVendorPhone && vPhone === pVendorPhone) return true;
                if (pVendorName && vBizName === pVendorName) return true;
                return false;
            });
        }

        if (matchedVendor) {
            const vStatus = (matchedVendor.status || '').toLowerCase().trim();
            const isVApproved = (vStatus === 'approved' || vStatus === 'active') && matchedVendor.isActive !== false;

            if (p.vendorStatus !== vStatus) {
                p.vendorStatus = vStatus;
                changed = true;
            }
            if (p.isVendorSuspended !== !isVApproved) {
                p.isVendorSuspended = !isVApproved;
                changed = true;
            }
            if (p.isSuspended !== !isVApproved) {
                p.isSuspended = !isVApproved;
                changed = true;
            }
            if (!isVApproved && p.isActive !== false) {
                p.isActive = false;
                changed = true;
            } else if (isVApproved && p.isActive === false && p.vendorStatus === 'suspended') {
                p.isActive = true;
                changed = true;
            }

            if (!p.vendorEmail && matchedVendor.email) {
                p.vendorEmail = matchedVendor.email;
                changed = true;
            }
            if (!p.vendorPhone && (matchedVendor.phone || matchedVendor.mobileNumber)) {
                p.vendorPhone = matchedVendor.phone || matchedVendor.mobileNumber;
                changed = true;
            }
            if (!p.vendorName && (matchedVendor.businessName || matchedVendor.name)) {
                p.vendorName = matchedVendor.businessName || matchedVendor.name;
                changed = true;
            }

            // Sync Business Outlet status if matched
            if (Array.isArray(matchedVendor.businesses)) {
                const pBizId = p.businessId ? p.businessId.toString() : pVendorId;
                const pBizName = (p.businessName || p.subNavbarCategory || '').toLowerCase().trim();

                const matchedBiz = matchedVendor.businesses.find(b => {
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
                    if (!isBActive && p.isActive !== false) {
                        p.isActive = false;
                        changed = true;
                    }
                }
            }
        }

        if (changed) {
            await p.save();
            console.log(`Updated Product "${p.name}" (${p._id}): vendorStatus="${p.vendorStatus}", isVendorSuspended=${p.isVendorSuspended}, isActive=${p.isActive}`);
            updatedCount++;
        }
    }

    console.log(`Successfully synced ${updatedCount} products with comprehensive vendor matching.`);
    await mongoose.disconnect();
}

syncAllProductsComprehensive().catch(console.error);
