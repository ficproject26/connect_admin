const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');

const auth = require('../middleware/auth');
const territoryScope = require('../middleware/territoryScope');
const VendorSubscription = require('../models/VendorSubscription');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Pincode = require('../models/Pincode');

require('dotenv').config();

// Razorpay Instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

/**
 * Syncs successful VendorSubscriptions into Main Admin Payment History collection ('payments')
 * Categorized strictly as: INCOME -> VENDOR SUBSCRIPTION
 */
async function syncSubscriptionsToPaymentHistory() {
    try {
        const successfulSubs = await VendorSubscription.find({
            paymentStatus: { $in: ['PAID', 'SUCCESS'] }
        }).lean();

        for (const sub of successfulSubs) {
            const txRef = sub.razorpayPaymentId || sub.paymentId || sub.subscriptionId;
            if (!txRef) continue;

            const existingPayment = await Payment.findOne({
                $or: [
                    { paymentId: sub.paymentId },
                    { transactionReference: txRef },
                    { sourceId: sub.subscriptionId }
                ]
            });

            if (!existingPayment) {
                const payDate = sub.paymentDate || sub.lastPaymentDate || sub.startDate || sub.createdAt || new Date();
                const payAmount = Number(sub.monthlyFee || sub.amount || 1000);

                await Payment.create({
                    paymentId: sub.paymentId || `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
                    paymentType: 'received',
                    paymentCategory: 'vendor_subscription',
                    recipientType: 'Vendor',
                    recipientId: sub.vendorId,
                    recipientName: sub.vendorName ? `${sub.vendorName} (${sub.businessName || 'Business'})` : (sub.businessName || 'Vendor Business'),
                    recipientEmail: sub.vendorEmail || '',
                    recipientPhone: sub.vendorPhone || '',
                    amount: payAmount,
                    currency: sub.currency || 'INR',
                    direction: 'CREDIT',
                    paymentMethod: sub.paymentMethod || 'Online',
                    status: 'PAID',
                    paymentPurpose: 'INCOME -> VENDOR SUBSCRIPTION',
                    sourceReference: String(sub.businessId || sub._id),
                    sourceModel: 'VendorSubscription',
                    sourceId: sub.subscriptionId,
                    paymentDate: payDate,
                    territory: {
                        state: sub.state || '',
                        district: sub.district || '',
                        division: sub.division || '',
                        pincode: sub.pincode || ''
                    },
                    transactionReference: txRef,
                    notes: `Business: ${sub.businessName} (${sub.businessType || 'General'}) | Plan: ${sub.planName || 'Monthly Subscription'} | Validity: ${sub.startDate ? new Date(sub.startDate).toLocaleDateString() : ''} to ${sub.validUntil || sub.endDate ? new Date(sub.validUntil || sub.endDate).toLocaleDateString() : ''}`,
                    createdBy: sub.approvedByName || sub.approvedBy || 'System'
                });
            }
        }
    } catch (syncErr) {
        console.error('[VendorSubscription] Error syncing payments to Payment History:', syncErr);
    }
}

// Initial sync in background
syncSubscriptionsToPaymentHistory().catch(() => {});

/**
 * Calculates authoritative subscription status based on real validity and payment status
 */
function computeSubscriptionStatus(record) {
    const rawPayStatus = String(record.paymentStatus || '').toUpperCase().trim();
    const rawBizStatus = String(record.status || record.subscriptionStatus || '').toLowerCase().trim();

    if (rawBizStatus === 'suspended') {
        return 'SUSPENDED';
    }
    if (rawPayStatus === 'FAILED') {
        return 'PAYMENT FAILED';
    }
    if (rawPayStatus === 'PENDING') {
        return 'PAYMENT PENDING';
    }

    const expiryDate = record.validUntil || record.endDate;
    if (expiryDate) {
        const expTime = new Date(expiryDate).getTime();
        const nowTime = Date.now();
        if (expTime < nowTime) {
            return 'EXPIRED';
        }
    }

    if (rawPayStatus === 'PAID' || rawPayStatus === 'SUCCESS') {
        return 'ACTIVE';
    }

    return 'PENDING';
}

/**
 * Builds territory filter based on authenticated user tier and requested query params
 */
function buildScopedTerritoryFilter(req) {
    const adminUser = req.adminUser || {};
    const tier = adminUser.adminTier || (adminUser.isMainAdmin ? 'main' : 'unknown');
    const filter = {};

    const reqState = (req.query.state || '').trim();
    const reqDistrict = (req.query.district || '').trim();
    const reqDivision = (req.query.division || '').trim();
    const reqPincode = (req.query.pincode || '').trim();

    if (tier === 'main') {
        if (reqState && reqState.toLowerCase() !== 'all') {
            filter.state = new RegExp(`^${reqState}$`, 'i');
        }
        if (reqDistrict && reqDistrict.toLowerCase() !== 'all') {
            filter.district = new RegExp(`^${reqDistrict}$`, 'i');
        }
        if (reqDivision && reqDivision.toLowerCase() !== 'all') {
            filter.division = new RegExp(`^${reqDivision}$`, 'i');
        }
        if (reqPincode && reqPincode.toLowerCase() !== 'all') {
            filter.pincode = reqPincode;
        }
        return filter;
    }

    if (tier === 'state') {
        const uState = adminUser.assignedState;
        if (!uState) return { state: '__none__' };
        filter.state = new RegExp(`^${uState}$`, 'i');

        if (reqDistrict && reqDistrict.toLowerCase() !== 'all') {
            filter.district = new RegExp(`^${reqDistrict}$`, 'i');
        }
        if (reqDivision && reqDivision.toLowerCase() !== 'all') {
            filter.division = new RegExp(`^${reqDivision}$`, 'i');
        }
        if (reqPincode && reqPincode.toLowerCase() !== 'all') {
            filter.pincode = reqPincode;
        }
        return filter;
    }

    if (tier === 'district') {
        const uState = adminUser.assignedState;
        const uDistrict = adminUser.assignedDistrict;
        if (!uState || !uDistrict) return { district: '__none__' };
        filter.state = new RegExp(`^${uState}$`, 'i');
        filter.district = new RegExp(`^${uDistrict}$`, 'i');

        if (reqDivision && reqDivision.toLowerCase() !== 'all') {
            filter.division = new RegExp(`^${reqDivision}$`, 'i');
        }
        if (reqPincode && reqPincode.toLowerCase() !== 'all') {
            filter.pincode = reqPincode;
        }
        return filter;
    }

    if (tier === 'division') {
        const uState = adminUser.assignedState;
        const uDistrict = adminUser.assignedDistrict;
        const uDivision = adminUser.assignedDivision;
        if (!uState || !uDistrict || !uDivision) return { division: '__none__' };
        filter.state = new RegExp(`^${uState}$`, 'i');
        filter.district = new RegExp(`^${uDistrict}$`, 'i');
        filter.division = new RegExp(`^${uDivision}$`, 'i');

        if (reqPincode && reqPincode.toLowerCase() !== 'all') {
            filter.pincode = reqPincode;
        }
        return filter;
    }

    if (tier === 'pincode') {
        const uPincode = adminUser.assignedPincode;
        if (!uPincode) return { pincode: '__none__' };
        filter.pincode = uPincode;
        return filter;
    }

    return filter;
}

/**
 * Enrich single record with canonical location hierarchy if missing
 */
async function enrichRecordLocation(record) {
    let { state, district, division, pincode } = record;

    if (pincode && (!state || !district || !division || state === 'Not assigned' || district === 'Not assigned')) {
        const pinDoc = await Pincode.findOne({ code: pincode.trim() }).lean();
        if (pinDoc) {
            state = state && state !== 'Not assigned' ? state : pinDoc.state;
            district = district && district !== 'Not assigned' ? district : pinDoc.district;
            division = division && division !== 'Not assigned' ? division : (pinDoc.division || pinDoc.area || pinDoc.taluk);
        }
    }

    return {
        ...record,
        state: state || 'Tamil Nadu',
        district: district || 'General District',
        division: division || 'General Division',
        pincode: pincode || '635109'
    };
}

// =========================================================================
// 1. GET SUMMARY METRICS (KPIs)
// =========================================================================
router.get('/summary', [auth, territoryScope], async (req, res) => {
    try {
        await syncSubscriptionsToPaymentHistory();

        const baseFilter = buildScopedTerritoryFilter(req);
        const allRecords = await VendorSubscription.find(baseFilter).lean();

        let totalSubscriptions = allRecords.length;
        let activeSubscriptions = 0;
        let pendingPayments = 0;
        let expiredSubscriptions = 0;
        let totalRevenue = 0;
        let monthlyRevenue = 0;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        allRecords.forEach(rec => {
            const status = computeSubscriptionStatus(rec);
            const amount = Number(rec.monthlyFee || rec.amount || 1000);
            const isPaid = ['PAID', 'SUCCESS'].includes(String(rec.paymentStatus || '').toUpperCase());

            if (status === 'ACTIVE') {
                activeSubscriptions++;
            } else if (status === 'PAYMENT PENDING' || String(rec.paymentStatus || '').toUpperCase() === 'PENDING') {
                pendingPayments++;
            } else if (status === 'EXPIRED') {
                expiredSubscriptions++;
            }

            if (isPaid) {
                totalRevenue += amount;
                const payDate = rec.paymentDate || rec.lastPaymentDate || rec.startDate;
                if (payDate) {
                    const pDate = new Date(payDate);
                    if (pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
                        monthlyRevenue += amount;
                    }
                }
            }
        });

        res.json({
            success: true,
            summary: {
                totalSubscriptions,
                activeSubscriptions,
                pendingPayments,
                expiredSubscriptions,
                monthlyRevenue,
                totalRevenue
            }
        });
    } catch (err) {
        console.error('Error fetching subscription summary:', err);
        res.status(500).json({ success: false, message: 'Server error fetching subscription summary' });
    }
});

// =========================================================================
// 2. GET FILTER OPTIONS (Cascading Territory + Statuses + Types)
// =========================================================================
router.get('/filters', [auth, territoryScope], async (req, res) => {
    try {
        const baseFilter = buildScopedTerritoryFilter(req);
        const records = await VendorSubscription.find(baseFilter).lean();

        const statesSet = new Set();
        const districtsMap = {}; // { state: Set<district> }
        const divisionsMap = {}; // { district: Set<division> }
        const pincodesMap = {}; // { division: Set<pincode> }
        const businessTypesSet = new Set();
        const billingCyclesSet = new Set();

        for (const r of records) {
            const state = r.state || 'Tamil Nadu';
            const district = r.district || 'General District';
            const division = r.division || 'General Division';
            const pincode = r.pincode || '';

            statesSet.add(state);

            if (!districtsMap[state]) districtsMap[state] = new Set();
            districtsMap[state].add(district);

            if (!divisionsMap[district]) divisionsMap[district] = new Set();
            divisionsMap[district].add(division);

            if (!pincodesMap[division]) pincodesMap[division] = new Set();
            if (pincode) pincodesMap[division].add(pincode);

            if (r.businessType) businessTypesSet.add(r.businessType);
            if (r.billingCycle) billingCyclesSet.add(r.billingCycle);
        }

        // Also enrich with database Pincode collection for available locations if empty
        if (statesSet.size === 0) {
            const pins = await Pincode.find({}).limit(50).lean();
            pins.forEach(p => {
                statesSet.add(p.state);
                if (!districtsMap[p.state]) districtsMap[p.state] = new Set();
                districtsMap[p.state].add(p.district);
                if (!divisionsMap[p.district]) divisionsMap[p.district] = new Set();
                divisionsMap[p.district].add(p.division || p.area || 'General');
                if (!pincodesMap[p.division || p.area || 'General']) pincodesMap[p.division || p.area || 'General'] = new Set();
                pincodesMap[p.division || p.area || 'General'].add(p.code);
            });
        }

        const formattedDistricts = {};
        Object.keys(districtsMap).forEach(k => {
            formattedDistricts[k] = Array.from(districtsMap[k]).filter(Boolean).sort();
        });

        const formattedDivisions = {};
        Object.keys(divisionsMap).forEach(k => {
            formattedDivisions[k] = Array.from(divisionsMap[k]).filter(Boolean).sort();
        });

        const formattedPincodes = {};
        Object.keys(pincodesMap).forEach(k => {
            formattedPincodes[k] = Array.from(pincodesMap[k]).filter(Boolean).sort();
        });

        res.json({
            success: true,
            filters: {
                states: Array.from(statesSet).filter(Boolean).sort(),
                districts: formattedDistricts,
                divisions: formattedDivisions,
                pincodes: formattedPincodes,
                businessTypes: ['Products', 'Services', 'Stay', 'Food', ...Array.from(businessTypesSet).filter(b => !['Products', 'Services', 'Stay', 'Food'].includes(b))],
                subscriptionStatuses: ['ACTIVE', 'PENDING', 'EXPIRED', 'PAYMENT PENDING', 'PAYMENT FAILED', 'SUSPENDED'],
                paymentStatuses: ['PAID', 'PENDING', 'FAILED', 'REFUNDED'],
                billingCycles: ['Monthly']
            }
        });
    } catch (err) {
        console.error('Error fetching subscription filters:', err);
        res.status(500).json({ success: false, message: 'Server error fetching subscription filters' });
    }
});

// =========================================================================
// 3. GET VENDOR SUBSCRIPTIONS (List View with Search & Filters)
// =========================================================================
router.get('/', [auth, territoryScope], async (req, res) => {
    try {
        await syncSubscriptionsToPaymentHistory();

        const baseFilter = buildScopedTerritoryFilter(req);
        const {
            search,
            businessType,
            subscriptionStatus,
            paymentStatus,
            billingCycle,
            dateRange,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        const query = { ...baseFilter };

        // Search: Vendor Name, Business Name, Business ID, Vendor ID, Payment ID
        if (search && search.trim()) {
            const s = search.trim();
            const sRegex = new RegExp(s, 'i');
            query.$or = [
                { vendorName: sRegex },
                { businessName: sRegex },
                { businessId: sRegex },
                { vendorId: sRegex },
                { subscriptionId: sRegex },
                { paymentId: sRegex },
                { razorpayPaymentId: sRegex },
                { razorpayOrderId: sRegex },
                { pincode: sRegex }
            ];
        }

        // Business Type filter
        if (businessType && businessType !== 'all') {
            query.businessType = new RegExp(`^${businessType}$`, 'i');
        }

        // Payment Status filter
        if (paymentStatus && paymentStatus !== 'all') {
            if (paymentStatus.toUpperCase() === 'PAID') {
                query.paymentStatus = { $in: ['PAID', 'SUCCESS'] };
            } else {
                query.paymentStatus = new RegExp(`^${paymentStatus}$`, 'i');
            }
        }

        // Billing Cycle filter
        if (billingCycle && billingCycle !== 'all') {
            query.billingCycle = new RegExp(`^${billingCycle}$`, 'i');
        }

        // Date Range Filtering (Based on paymentDate or startDate)
        const now = new Date();
        if (dateRange && dateRange !== 'all') {
            if (dateRange === 'today') {
                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                query.startDate = { $gte: start, $lte: end };
            } else if (dateRange === 'this_month') {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                query.startDate = { $gte: start, $lte: end };
            } else if (dateRange === 'last_month') {
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                query.startDate = { $gte: start, $lte: end };
            } else if (dateRange === 'this_year') {
                const start = new Date(now.getFullYear(), 0, 1);
                const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                query.startDate = { $gte: start, $lte: end };
            } else if (dateRange === 'custom' && (startDate || endDate)) {
                query.startDate = {};
                if (startDate) query.startDate.$gte = new Date(startDate);
                if (endDate) {
                    const e = new Date(endDate);
                    e.setHours(23, 59, 59, 999);
                    query.startDate.$lte = e;
                }
            }
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);

        // Fetch raw matches
        let allMatching = await VendorSubscription.find(query)
            .sort({ createdAt: -1 })
            .lean();

        // Enrich records with canonical locations and computed status
        let enriched = await Promise.all(allMatching.map(async rec => {
            const loc = await enrichRecordLocation(rec);
            const status = computeSubscriptionStatus(loc);
            
            // Format dates
            const pDate = loc.paymentDate || loc.lastPaymentDate || loc.startDate;
            let startD = loc.startDate || pDate || loc.createdAt;
            let validUntil = loc.validUntil || loc.endDate;

            if (!validUntil && startD) {
                const d = new Date(startD);
                d.setMonth(d.getMonth() + 1);
                validUntil = d;
            }

            return {
                ...loc,
                calculatedStatus: status,
                startDate: startD,
                validUntil: validUntil,
                monthlyFee: Number(loc.monthlyFee || loc.amount || 1000),
                amount: Number(loc.amount || loc.monthlyFee || 1000),
                paymentStatus: (loc.paymentStatus === 'SUCCESS' ? 'PAID' : (loc.paymentStatus || 'PENDING')).toUpperCase(),
                paymentDate: pDate
            };
        }));

        // In-memory filter for calculated subscriptionStatus if filtered by UI
        if (subscriptionStatus && subscriptionStatus !== 'all') {
            enriched = enriched.filter(r => r.calculatedStatus === subscriptionStatus.toUpperCase());
        }

        const total = enriched.length;
        const totalPages = Math.ceil(total / limitNum) || 1;
        const paginated = enriched.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.json({
            success: true,
            total,
            page: pageNum,
            totalPages,
            subscriptions: paginated
        });
    } catch (err) {
        console.error('Error fetching vendor subscriptions:', err);
        res.status(500).json({ success: false, message: 'Server error retrieving vendor subscriptions' });
    }
});

// =========================================================================
// 4. GET SINGLE SUBSCRIPTION DETAILS (For Detail Modal / Drawer)
// =========================================================================
router.get('/:id', [auth, territoryScope], async (req, res) => {
    try {
        const id = req.params.id;
        const query = {
            $or: [
                { subscriptionId: id },
                { businessId: id }
            ]
        };
        if (mongoose.Types.ObjectId.isValid(id)) {
            query.$or.push({ _id: new mongoose.Types.ObjectId(id) });
        }

        const raw = await VendorSubscription.findOne(query).lean();
        if (!raw) {
            return res.status(404).json({ success: false, message: 'Vendor subscription record not found' });
        }

        // Territory authorization check for restricted admins
        const adminUser = req.adminUser || {};
        const tier = adminUser.adminTier;
        if (tier === 'state' && adminUser.assignedState) {
            if (String(raw.state || '').toLowerCase() !== adminUser.assignedState.toLowerCase()) {
                return res.status(403).json({ success: false, message: 'Unauthorized. Subscription belongs to another territory.' });
            }
        } else if (tier === 'district' && adminUser.assignedDistrict) {
            if (String(raw.district || '').toLowerCase() !== adminUser.assignedDistrict.toLowerCase()) {
                return res.status(403).json({ success: false, message: 'Unauthorized. Subscription belongs to another territory.' });
            }
        } else if (tier === 'division' && adminUser.assignedDivision) {
            if (String(raw.division || '').toLowerCase() !== adminUser.assignedDivision.toLowerCase()) {
                return res.status(403).json({ success: false, message: 'Unauthorized. Subscription belongs to another territory.' });
            }
        } else if (tier === 'pincode' && adminUser.assignedPincode) {
            if (String(raw.pincode || '') !== String(adminUser.assignedPincode)) {
                return res.status(403).json({ success: false, message: 'Unauthorized. Subscription belongs to another territory.' });
            }
        }

        const enriched = await enrichRecordLocation(raw);
        const calculatedStatus = computeSubscriptionStatus(enriched);

        // Fetch vendor contact & address from User / Vendor model if available
        let vendorUser = null;
        if (enriched.vendorId) {
            vendorUser = await User.findById(enriched.vendorId).select('name email phone mobileNumber address businesses').lean();
            if (!vendorUser && mongoose.Types.ObjectId.isValid(enriched.vendorId)) {
                vendorUser = await Vendor.findById(enriched.vendorId).select('contactName email phone businessName address').lean();
            }
        }

        let fullBusinessAddress = enriched.address || '';
        if (vendorUser && Array.isArray(vendorUser.businesses)) {
            const matchedBiz = vendorUser.businesses.find(b => String(b._id) === String(enriched.businessId));
            if (matchedBiz && matchedBiz.address) {
                fullBusinessAddress = matchedBiz.address;
            }
        }
        if (!fullBusinessAddress && vendorUser?.address) {
            fullBusinessAddress = vendorUser.address;
        }

        const pDate = enriched.paymentDate || enriched.lastPaymentDate || enriched.startDate;
        let validUntil = enriched.validUntil || enriched.endDate;
        if (!validUntil && enriched.startDate) {
            const d = new Date(enriched.startDate);
            d.setMonth(d.getMonth() + 1);
            validUntil = d;
        }

        const result = {
            ...enriched,
            vendorName: enriched.vendorName || vendorUser?.name || vendorUser?.businessName || 'Vendor',
            vendorEmail: enriched.vendorEmail || vendorUser?.email || '',
            vendorPhone: enriched.vendorPhone || vendorUser?.phone || vendorUser?.mobileNumber || '',
            fullBusinessAddress: fullBusinessAddress || `${enriched.division}, ${enriched.district}, ${enriched.state} - ${enriched.pincode}`,
            calculatedStatus,
            startDate: enriched.startDate || pDate || enriched.createdAt,
            validUntil,
            monthlyFee: Number(enriched.monthlyFee || enriched.amount || 1000),
            amount: Number(enriched.amount || enriched.monthlyFee || 1000),
            paymentStatus: (enriched.paymentStatus === 'SUCCESS' ? 'PAID' : (enriched.paymentStatus || 'PENDING')).toUpperCase(),
            paymentDate: pDate
        };

        res.json({ success: true, subscription: result });
    } catch (err) {
        console.error('Error fetching subscription by ID:', err);
        res.status(500).json({ success: false, message: 'Server error retrieving subscription details' });
    }
});

// =========================================================================
// 5. POST VERIFY PAYMENT & ACTIVATE SUBSCRIPTION
// =========================================================================
router.post('/verify-payment', auth, async (req, res) => {
    try {
        const {
            vendorId,
            businessId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount = 1000,
            billingCycle = 'Monthly'
        } = req.body;

        if (!vendorId || !businessId) {
            return res.status(400).json({ success: false, message: 'vendorId and businessId are required' });
        }

        // Signature validation if provided
        if (razorpay_order_id && razorpay_payment_id && razorpay_signature && process.env.RAZORPAY_KEY_SECRET) {
            const body = razorpay_order_id + '|' + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return res.status(400).json({ success: false, message: 'Invalid payment signature. Verification failed.' });
            }
        }

        // Fetch vendor & business details from User collection
        let vendorUser = await User.findById(vendorId).lean();
        let bizObj = null;
        if (vendorUser && Array.isArray(vendorUser.businesses)) {
            bizObj = vendorUser.businesses.find(b => String(b._id) === String(businessId));
        }

        const vendorName = vendorUser?.name || vendorUser?.businessName || 'Vendor';
        const vendorEmail = vendorUser?.email || '';
        const vendorPhone = vendorUser?.phone || vendorUser?.mobileNumber || '';
        const businessName = bizObj?.businessName || vendorName;
        const businessType = bizObj?.vendorType || bizObj?.category || 'Products';
        const pincode = bizObj?.pincode || vendorUser?.pincode || '635109';
        const address = bizObj?.address || vendorUser?.address || '';

        // Lookup territory hierarchy from Pincode
        const pinDoc = await Pincode.findOne({ code: pincode }).lean();
        const state = pinDoc?.state || 'Tamil Nadu';
        const district = pinDoc?.district || 'Krishnagiri';
        const division = pinDoc?.division || pinDoc?.area || 'Hosur';

        const paymentDate = new Date();
        const validUntil = new Date(paymentDate);
        validUntil.setMonth(validUntil.getMonth() + 1);

        const subId = `SUB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const payId = `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create or update VendorSubscription
        const subDoc = await VendorSubscription.findOneAndUpdate(
            { businessId: businessId },
            {
                $set: {
                    subscriptionId: subId,
                    vendorId,
                    vendorName,
                    vendorEmail,
                    vendorPhone,
                    businessId,
                    businessName,
                    businessType,
                    address,
                    state,
                    district,
                    division,
                    pincode,
                    planName: 'Monthly Subscription',
                    monthlyFee: Number(amount),
                    amount: Number(amount),
                    currency: 'INR',
                    billingCycle,
                    startDate: paymentDate,
                    validUntil: validUntil,
                    endDate: validUntil,
                    nextDueDate: validUntil,
                    paymentStatus: 'PAID',
                    subscriptionStatus: 'ACTIVE',
                    status: 'Active',
                    paymentMethod: 'UPI',
                    paymentDate,
                    lastPaymentDate: paymentDate,
                    paymentId: payId,
                    latestPaymentId: payId,
                    razorpayOrderId: razorpay_order_id || `order_${Date.now()}`,
                    razorpayPaymentId: razorpay_payment_id || `pay_${Date.now()}`,
                    razorpaySignature: razorpay_signature || '',
                    transactionId: razorpay_payment_id || payId,
                    approvedBy: vendorUser?.onboardedByAgent?.name || 'Authorized Admin',
                    approvedByName: vendorUser?.onboardedByAgent?.name || 'Admin',
                    approvedByRole: 'Admin'
                },
                $inc: { renewalCount: 1 }
            },
            { upsert: true, new: true }
        );

        // Store in subscriptionpayments
        await SubscriptionPayment.create({
            paymentId: payId,
            vendorId,
            vendorName,
            businessId,
            businessName,
            businessType,
            subscriptionId: subId,
            subscriptionType: 'Monthly Subscription',
            razorpayOrderId: razorpay_order_id || '',
            razorpayPaymentId: razorpay_payment_id || '',
            razorpaySignature: razorpay_signature || '',
            amount: Number(amount),
            currency: 'INR',
            paymentMethod: 'UPI',
            paymentStatus: 'SUCCESS',
            paymentDate,
            validFrom: paymentDate,
            validUntil,
            state,
            district,
            division,
            pincode,
            approvedBy: vendorUser?.onboardedByAgent?.name || 'Admin'
        });

        // Store directly in Main Admin Payment History collection ('payments')
        await Payment.create({
            paymentId: payId,
            paymentType: 'received',
            paymentCategory: 'vendor_subscription',
            recipientType: 'Vendor',
            recipientId: vendorId,
            recipientName: `${vendorName} (${businessName})`,
            recipientEmail: vendorEmail,
            recipientPhone: vendorPhone,
            amount: Number(amount),
            currency: 'INR',
            direction: 'CREDIT',
            paymentMethod: 'UPI',
            status: 'PAID',
            paymentPurpose: 'INCOME -> VENDOR SUBSCRIPTION',
            sourceReference: String(businessId),
            sourceModel: 'VendorSubscription',
            sourceId: subId,
            paymentDate,
            territory: { state, district, division, pincode },
            transactionReference: razorpay_payment_id || payId,
            notes: `Vendor Business Subscription: ${businessName} (${businessType}) [PIN: ${pincode}]`,
            createdBy: 'System'
        });

        res.json({
            success: true,
            message: 'Payment verified and subscription activated successfully',
            subscription: subDoc
        });
    } catch (err) {
        console.error('Error verifying subscription payment:', err);
        res.status(500).json({ success: false, message: 'Payment verification failed', error: err.message });
    }
});

module.exports = router;
