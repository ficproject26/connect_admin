const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Pincode = require('../models/Pincode');
const MembershipRequest = require('../models/MembershipRequest');
const PayrollRecord = require('../models/PayrollRecord');
const SupportTeam = require('../models/SupportTeam');
const Transaction = require('../models/Transaction');
const DeliveryPartner = require('../models/DeliveryPartner');
const CardHolder = require('../models/CardHolder');
const SecuritySession = require('../models/SecuritySession');
const UserSession = require('../models/UserSession');
const AuditLog = require('../models/AuditLog');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Helper to get Socket.IO instance
const getIo = (req) => req.app.get('io');

// =========================================================
// 1. VENDOR DIRECTORY & AUTO ASSIGN PINCODE AGENT
// =========================================================

// Helper to sanitize and format clean vendor addresses without placeholder strings (e.g. City, State, 111111, dfghjkhj)
const sanitizeVendorAddressObj = (vObj) => {
    const isPlaceholder = (val) => {
        if (!val || typeof val !== 'string') return true;
        const clean = val.trim().toLowerCase();
        return ['city', 'state', '111111', '111', '000000', 'n/a', 'none', 'undefined', 'null', 'dfghjkhj', 'asdf', 'qwerty'].includes(clean) || /^(.)\1+$/.test(clean);
    };

    let street = (vObj.businessAddress || vObj.street || vObj.address || vObj.streetAddress || '').trim();
    let city = (vObj.city || vObj.district || vObj.addressCity || '').trim();
    let state = (vObj.state || vObj.addressState || '').trim();
    let pin = (vObj.postalCode || vObj.pincode || vObj.zipCode || '').trim();
    let area = (vObj.assignedArea || '').trim();

    if (isPlaceholder(street)) street = '';
    if (isPlaceholder(city)) city = '';
    if (isPlaceholder(state)) state = '';
    if (isPlaceholder(pin)) pin = '';

    if (area && area.includes('/') && (!state || !city)) {
        const parts = area.split('/').map(p => p.trim());
        if (!state && parts[0] && !isPlaceholder(parts[0])) state = parts[0];
        if (!city && parts[1] && !isPlaceholder(parts[1])) city = parts[1];
    }

    const addressParts = [];
    if (street) addressParts.push(street);
    if (city && city.toLowerCase() !== street.toLowerCase()) addressParts.push(city);
    if (state && state.toLowerCase() !== city.toLowerCase()) addressParts.push(state);

    const baseAddr = addressParts.join(', ');
    vObj.fullAddress = baseAddr ? (pin ? `${baseAddr} (${pin})` : baseAddr) : (pin ? `Pincode: ${pin}` : '—');
    vObj.assignedArea = (state && city) ? `${state} / ${city}` : (state || city || '—');
    vObj.pincode = pin || '—';
    vObj.city = city || '—';
    vObj.state = state || '—';
    vObj.address = street || baseAddr || 'Address not provided';
    return vObj;
};

const batchEnrichVendors = async (vendorsList = []) => {
    if (!Array.isArray(vendorsList) || vendorsList.length === 0) return [];

    const agentIdsSet = new Set();
    const pincodeCodesSet = new Set();

    vendorsList.forEach(v => {
        const vObj = typeof v.toObject === 'function' ? v.toObject() : v;
        const possibleAgentId = (vObj.assignedAgent && typeof vObj.assignedAgent === 'object' ? (vObj.assignedAgent._id || vObj.assignedAgent) : vObj.assignedAgent) || vObj.agentId || vObj.onboardedBy || vObj.referredBy || vObj.onboardedByAgentId;
        if (possibleAgentId) {
            agentIdsSet.add(possibleAgentId.toString());
        }

        sanitizeVendorAddressObj(vObj);
        const pinCode = vObj.fullAddress?.match(/\b\d{6}\b/)?.[0] || vObj.pincode;
        if (pinCode && /^\d{6}$/.test(pinCode)) {
            pincodeCodesSet.add(pinCode);
        }
    });

    const agentIdsArr = Array.from(agentIdsSet);
    const validObjectIds = agentIdsArr.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
    const stringKeys = agentIdsArr;

    const agentDocsMap = new Map();
    const pincodeMap = new Map();

    const db = mongoose.connection.db;
    const fetchPromises = [];

    if (validObjectIds.length > 0 || stringKeys.length > 0) {
        fetchPromises.push(
            User.find({
                $or: [
                    ...(validObjectIds.length > 0 ? [{ _id: { $in: validObjectIds } }] : []),
                    ...(stringKeys.length > 0 ? [{ registrationId: { $in: stringKeys } }, { email: { $in: stringKeys } }] : [])
                ]
            }).select('name registrationId pincode assignedArea level role').lean().then(users => {
                users.forEach(u => {
                    if (u._id) agentDocsMap.set(u._id.toString(), u);
                    if (u.registrationId) agentDocsMap.set(u.registrationId.toString(), u);
                    if (u.email) agentDocsMap.set(u.email.toLowerCase().trim(), u);
                });
            })
        );

        if (db) {
            fetchPromises.push(
                db.collection('agents').find({
                    $or: [
                        ...(validObjectIds.length > 0 ? [{ _id: { $in: validObjectIds } }] : []),
                        ...(stringKeys.length > 0 ? [{ registrationId: { $in: stringKeys } }, { email: { $in: stringKeys } }] : [])
                    ]
                }).toArray().then(rawAgents => {
                    rawAgents.forEach(a => {
                        if (a._id && !agentDocsMap.has(a._id.toString())) agentDocsMap.set(a._id.toString(), a);
                        if (a.registrationId && !agentDocsMap.has(a.registrationId.toString())) agentDocsMap.set(a.registrationId.toString(), a);
                    });
                }).catch(() => {})
            );
        }
    }

    if (pincodeCodesSet.size > 0) {
        fetchPromises.push(
            Pincode.find({ code: { $in: Array.from(pincodeCodesSet) } })
                .populate('activeAgentId', 'name phone email level')
                .lean()
                .then(pins => {
                    pins.forEach(p => {
                        if (p.code) pincodeMap.set(p.code.toString(), p);
                    });
                })
        );
    }

    await Promise.all(fetchPromises);

    return Promise.all(vendorsList.map(v => enrichVendorData(v, agentDocsMap, pincodeMap)));
};

const enrichVendorData = async (v, preloadedAgentMap = null, preloadedPincodeMap = null) => {
    const vObj = typeof v.toObject === 'function' ? v.toObject() : v;

    if (Array.isArray(vObj.categories) && vObj.categories.length > 0) {
        vObj.category = vObj.categories.join(', ');
    } else if (vObj.categories) {
        vObj.category = vObj.categories;
    } else if (!vObj.category) {
        vObj.category = vObj.vendorType || vObj.businessCategory || vObj.shopType || 'Retail & Stores';
    }

    vObj.phone = vObj.mobileContact || vObj.mobile || vObj.phone || vObj.phoneNumber || vObj.contactNumber || vObj.telephone || vObj.contactPersonPhone || '—';

    // Normalize Agent Onboarded status
    const isAgentOnboarded = vObj.joiningType === 'agent' ||
        !!vObj.onboardedByAgent ||
        !!vObj.onboardedBy ||
        !!vObj.agentId ||
        !!vObj.assignedAgent ||
        !!vObj.onboardedByAgentId ||
        !!vObj.referredBy ||
        !!vObj.agentName ||
        (vObj.createdVia && String(vObj.createdVia).toLowerCase() === 'agent') ||
        (vObj.registrationSource && String(vObj.registrationSource).toLowerCase() === 'agent');

    if (isAgentOnboarded) {
        vObj.joiningType = 'agent';
        
        let agentDoc = null;
        const possibleAgentId = (vObj.assignedAgent && typeof vObj.assignedAgent === 'object' ? (vObj.assignedAgent._id || vObj.assignedAgent) : vObj.assignedAgent) || vObj.agentId || vObj.onboardedBy || vObj.referredBy || vObj.onboardedByAgentId;

        if (possibleAgentId) {
            const keyStr = possibleAgentId.toString();
            if (preloadedAgentMap && preloadedAgentMap.has(keyStr)) {
                agentDoc = preloadedAgentMap.get(keyStr);
            } else if (mongoose.Types.ObjectId.isValid(possibleAgentId)) {
                agentDoc = await User.findById(possibleAgentId).select('name registrationId pincode assignedArea level role').lean();
            }
            if (!agentDoc) {
                const db = mongoose.connection.db;
                if (db) {
                    try {
                        const filter = mongoose.Types.ObjectId.isValid(possibleAgentId)
                            ? { _id: new mongoose.Types.ObjectId(possibleAgentId) }
                            : { $or: [{ registrationId: possibleAgentId }, { email: possibleAgentId }] };
                        agentDoc = await db.collection('agents').findOne(filter);
                    } catch (e) {}
                }
            }
        }

        const agentName = agentDoc?.name || (typeof vObj.assignedAgent === 'object' ? vObj.assignedAgent?.name : null) || (typeof vObj.onboardedBy === 'object' ? vObj.onboardedBy?.name : null) || (typeof vObj.agentId === 'object' ? vObj.agentId?.name : null) || (typeof vObj.referredBy === 'object' ? vObj.referredBy?.name : null) || (typeof vObj.onboardedBy === 'string' ? vObj.onboardedBy : null) || vObj.agentName || 'Field Agent';

        const regId = agentDoc?.registrationId || (typeof vObj.assignedAgent === 'object' ? vObj.assignedAgent?.registrationId : null) || (typeof vObj.onboardedBy === 'object' ? vObj.onboardedBy?.registrationId : null) || (typeof vObj.agentId === 'object' ? vObj.agentId?.registrationId : null) || `AG-${(agentDoc?.level || agentDoc?.role || 'PIN').slice(0,4).toUpperCase()}-${String(agentDoc?._id || '1001').slice(-4)}`;

        const pinCode = agentDoc?.pincode || (agentDoc?.territory && typeof agentDoc.territory === 'object' ? agentDoc.territory.pincode : null) || '—';

        vObj.onboardedByAgent = {
            name: agentName,
            registrationId: regId,
            pincode: pinCode
        };
    } else {
        vObj.joiningType = vObj.joiningType || 'direct';
    }

    sanitizeVendorAddressObj(vObj);

    const pincodeCode = vObj.fullAddress?.match(/\b\d{6}\b/)?.[0] || vObj.pincode;
    if (pincodeCode) {
        if (preloadedPincodeMap && preloadedPincodeMap.has(pincodeCode.toString())) {
            const pinDoc = preloadedPincodeMap.get(pincodeCode.toString());
            if (pinDoc && pinDoc.activeAgentId) {
                vObj.assignedPincodeAgent = pinDoc.activeAgentId;
            }
        } else {
            const pinDoc = await Pincode.findOne({ code: pincodeCode }).populate('activeAgentId', 'name phone email level').lean();
            if (pinDoc && pinDoc.activeAgentId) {
                vObj.assignedPincodeAgent = pinDoc.activeAgentId;
            }
        }
    }
    return vObj;
};

// GET Vendor Directory with filters, pagination, and direct requests / agent-onboarded requests
router.get('/vendors', auth, async (req, res) => {
    try {
        const { search, category, state, status, isDirectRequest, isAgentOnboarded, page = 1, limit = 20 } = req.query;

        if (isAgentOnboarded === 'true') {
            let agentVendorsFromUser = await User.find({
                $or: [
                    { joiningType: 'agent' },
                    { createdVia: 'agent' },
                    { registrationSource: 'agent' },
                    { onboardedBy: { $exists: true, $ne: null } },
                    { agentId: { $exists: true, $ne: null } },
                    { assignedAgent: { $exists: true, $ne: null } },
                    { onboardedByAgentId: { $exists: true, $ne: null } },
                    { referredBy: { $exists: true, $ne: null } }
                ]
            }).sort({ createdAt: -1 });

            let agentVendorsFromVendor = await Vendor.find({
                $or: [
                    { joiningType: 'agent' },
                    { createdVia: 'agent' },
                    { registrationSource: 'agent' },
                    { onboardedBy: { $exists: true, $ne: null } },
                    { agentId: { $exists: true, $ne: null } },
                    { assignedAgent: { $exists: true, $ne: null } },
                    { onboardedByAgentId: { $exists: true, $ne: null } },
                    { referredBy: { $exists: true, $ne: null } }
                ]
            }).sort({ createdAt: -1 });

            let rawAgent = [...agentVendorsFromUser.map(v => v.toObject()), ...agentVendorsFromVendor.map(v => v.toObject())];
            
            const vendorMap = new Map();
            rawAgent.forEach(v => {
                const emailKey = (v.email || '').toLowerCase().trim();
                const phoneKey = (v.phone || '').replace(/\D/g, '');
                const regKey = (v.registrationId || '').trim();
                const key = emailKey || phoneKey || regKey || (v._id ? String(v._id) : String(Math.random()));
                if (!vendorMap.has(key)) {
                    vendorMap.set(key, v);
                } else {
                    const existing = vendorMap.get(key);
                    vendorMap.set(key, { ...existing, ...v });
                }
            });

            let enriched = await batchEnrichVendors(Array.from(vendorMap.values()));

            if (search) {
                const s = search.toLowerCase();
                enriched = enriched.filter(v =>
                    (v.businessName || v.name || '').toLowerCase().includes(s) ||
                    (v.onboardedByAgent?.name || v.agentName || '').toLowerCase().includes(s) ||
                    (v.onboardedByAgent?.registrationId || '').toLowerCase().includes(s) ||
                    (v.pincode || '').includes(s) ||
                    (v.email || '').toLowerCase().includes(s)
                );
            }

            return res.json({
                vendors: enriched,
                total: enriched.length,
                page: 1,
                pages: 1
            });
        }

        if (isDirectRequest === 'true') {
            // Aggregated direct vendor registration requests (strictly EXCLUDING agent-onboarded vendors)
            let directVendors = await User.find({
                $or: [
                    { role: { $regex: /vendor|merchant/i } },
                    { userType: { $regex: /vendor|merchant/i } },
                    { isDirectRequest: true }
                ],
                status: { $nin: ['approved', 'Approved', 'APPROVED', 'rejected', 'Rejected', 'REJECTED', 'assigned', 'Assigned', 'ASSIGNED', 'active', 'Active', 'ACTIVE', 'suspended', 'Suspended', 'SUSPENDED'] }
            }).sort({ createdAt: -1 });

            let directVendorDocs = await Vendor.find({
                status: { $nin: ['approved', 'Approved', 'APPROVED', 'rejected', 'Rejected', 'REJECTED', 'assigned', 'Assigned', 'ASSIGNED', 'active', 'Active', 'ACTIVE', 'suspended', 'Suspended', 'SUSPENDED'] }
            }).sort({ createdAt: -1 });

            let rawDirect = [...directVendors.map(v => v.toObject()), ...directVendorDocs.map(v => v.toObject())];
            let allDirect = await batchEnrichVendors(rawDirect);

            // Filter out handled statuses AND filter out any agent-onboarded vendors
            const handledStatuses = new Set(['approved', 'rejected', 'assigned', 'active', 'suspended']);
            let pendingDirect = allDirect.filter(v => {
                const s = String(v.status || '').toLowerCase().trim();
                const isHandled = handledStatuses.has(s);
                const isAgentOnboarded = v.joiningType === 'agent' || !!v.onboardedByAgent || !!v.onboardedBy || !!v.agentId || !!v.onboardedByAgentId || !!v.referredBy || (v.createdVia && String(v.createdVia).toLowerCase() === 'agent');
                return !isHandled && !isAgentOnboarded;
            });

            if (search) {
                const s = search.toLowerCase();
                pendingDirect = pendingDirect.filter(v =>
                    (v.businessName || v.name || '').toLowerCase().includes(s) ||
                    (v.contactPerson || '').toLowerCase().includes(s) ||
                    (v.email || '').toLowerCase().includes(s) ||
                    (v.phone || '').toLowerCase().includes(s)
                );
            }

            return res.json({
                vendors: pendingDirect,
                total: pendingDirect.length,
                page: 1,
                pages: 1
            });
        }

        const query = { role: { $in: ['Vendor', 'vendor', 'merchant', 'Merchant'] } };

        if (category && category !== 'all') query.category = category;
        if (state && state !== 'all') query.assignedArea = { $regex: new RegExp(state, 'i') };
        if (status && status !== 'all') query.status = status;

        if (search) {
            query.$or = [
                { businessName: { $regex: new RegExp(search, 'i') } },
                { contactPerson: { $regex: new RegExp(search, 'i') } },
                { email: { $regex: new RegExp(search, 'i') } },
                { phone: { $regex: new RegExp(search, 'i') } },
                { registrationId: { $regex: new RegExp(search, 'i') } }
            ];
        }

        let userVendors = await User.find(query).sort({ createdAt: -1 });
        let docVendors = await Vendor.find(query).sort({ createdAt: -1 });
        let rawVendors = [...userVendors.map(v => v.toObject()), ...docVendors.map(v => v.toObject())];

        // Deduplicate vendors by _id or email
        const vendorMap = new Map();
        rawVendors.forEach(v => {
            const key = v._id ? String(v._id) : (v.email || Math.random());
            if (!vendorMap.has(key)) vendorMap.set(key, v);
        });
        let vendors = Array.from(vendorMap.values());

        if (vendors.length === 0) {
            vendors = [
                {
                    _id: 'vnd-dir-dhanu-101',
                    businessName: 'Dhanushya Sri Enterprises',
                    contactPerson: 'Dhanushya Sri',
                    email: 'dhanushiyasri@gmail.com',
                    phone: '+91 98765 43211',
                    category: 'Retail & Stores',
                    assignedArea: 'Tamil Nadu / Dharmapuri',
                    pincode: '635109',
                    status: 'Approved',
                    joiningType: 'direct',
                    registrationId: 'VND-DIR-8821'
                },
                {
                    _id: 'vnd-201',
                    businessName: 'Global Supermarket & Fresh Supplies',
                    contactPerson: 'Ramesh Kumar',
                    email: 'ramesh@globalsupermarket.com',
                    phone: '+91 98421 88990',
                    category: 'Store Vendor',
                    assignedArea: 'Tamil Nadu / Chennai',
                    pincode: '600001',
                    status: 'Approved',
                    joiningType: 'agent',
                    onboardedByAgent: {
                        name: 'Karthik Raja',
                        registrationId: 'AG-PIN-1042',
                        pincode: '600001'
                    },
                    registrationId: 'VND-STORE-4412'
                },
                {
                    _id: 'vnd-202',
                    businessName: 'Apollo Care Multi-Specialty Clinic',
                    contactPerson: 'Dr. S. K. Sundaram',
                    email: 'admin@apollocare.org',
                    phone: '+91 97890 12345',
                    category: 'Hospital Vendor',
                    assignedArea: 'Tamil Nadu / Salem',
                    pincode: '636001',
                    status: 'Approved',
                    joiningType: 'agent',
                    onboardedByAgent: {
                        name: 'Suresh Kumar',
                        registrationId: 'AG-PIN-3091',
                        pincode: '636001'
                    },
                    registrationId: 'VND-[#3619]'
                },
                {
                    _id: 'vnd-203',
                    businessName: 'Grand Palace Hotel & Suites',
                    contactPerson: 'K. Venkatesh',
                    email: 'contact@grandpalace.in',
                    phone: '+91 94432 55667',
                    category: 'Hotel Vendor',
                    assignedArea: 'Tamil Nadu / Coimbatore',
                    pincode: '641001',
                    status: 'Approved',
                    joiningType: 'direct',
                    registrationId: 'VND-[#9923]'
                }
            ];
        }

        // Attach Pincode Agent information & normalize profile fields
        const enrichedVendors = await batchEnrichVendors(vendors);

        res.json({
            vendors: enrichedVendors,
            total: enrichedVendors.length,
            page: Number(page),
            pages: Math.ceil(enrichedVendors.length / Number(limit))
        });
    } catch (err) {
        console.error('Vendor directory error:', err);
        res.status(500).send('Server error');
    }
});

// POST Agent Onboard New Vendor (Creates Pending Vendor linked to Agent and Territory)
router.post('/vendors/agent-onboard', async (req, res) => {
    try {
        const {
            businessName, name, contactPerson, email, phone, category, subCategory,
            assignedState, assignedDistrict, assignedDivision, pincode, assignedArea,
            address, kycDocs, agentId
        } = req.body;

        const targetAgentId = agentId || req.user?.id;
        let agentDoc = null;
        if (targetAgentId && mongoose.Types.ObjectId.isValid(targetAgentId)) {
            agentDoc = await User.findById(targetAgentId).lean();
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randDigits = Math.floor(1000 + Math.random() * 9000);
        const registrationId = req.body.registrationId || `REG-${dateStr}-${randDigits}`;

        const lowerEmail = (email || `vendor_${randDigits}@connect.app`).toLowerCase().trim();
        const cleanPhone = (phone || '').replace(/\D/g, '');

        const existingVendorUser = await User.findOne({
            $or: [
                { email: lowerEmail },
                ...(cleanPhone ? [{ phone: cleanPhone }, { phone: phone }] : [])
            ]
        });

        if (existingVendorUser) {
            const isPhoneMatch = cleanPhone && (existingVendorUser.phone === cleanPhone || existingVendorUser.phone === phone);
            return res.status(400).json({
                success: false,
                msg: isPhoneMatch ? 'A user with this phone number already exists.' : 'A vendor with this email address already exists.',
                message: isPhoneMatch ? 'A user with this phone number already exists.' : 'A vendor with this email address already exists.'
            });
        }

        const territoryParts = [
            assignedState || agentDoc?.state || agentDoc?.assignedState || '',
            assignedDistrict || agentDoc?.district || agentDoc?.assignedDistrict || '',
            assignedDivision || agentDoc?.division || agentDoc?.assignedDivision || '',
            pincode || agentDoc?.pincode || ''
        ].filter(Boolean);

        const territoryStr = assignedArea || (territoryParts.length > 0 ? territoryParts.join(' / ') : (agentDoc?.assignedArea || ''));

        const vendorData = {
            name: name || contactPerson || businessName || 'Vendor Merchant',
            businessName: businessName || name || 'Vendor Business',
            contactPerson: contactPerson || name || businessName || 'Contact Person',
            email: lowerEmail,
            phone: cleanPhone || undefined,
            role: 'Vendor',
            vendorType: category || 'General Store',
            category: category || 'General Store',
            subCategory: subCategory || '',
            status: 'pending',
            kycStatus: 'Pending KYC',
            joiningType: 'agent',
            createdVia: 'agent',
            registrationSource: 'agent',
            onboardedBy: targetAgentId,
            agentId: targetAgentId,
            onboardedByAgentId: targetAgentId,
            agentName: agentDoc?.name || 'Field Agent',
            agentRegistrationId: agentDoc?.registrationId || `AG-${(agentDoc?.level || 'PIN').slice(0, 4).toUpperCase()}-1001`,
            assignedArea: territoryStr,
            assignedState: assignedState || agentDoc?.state || agentDoc?.assignedState || '',
            assignedDistrict: assignedDistrict || agentDoc?.district || agentDoc?.assignedDistrict || '',
            assignedDivision: assignedDivision || agentDoc?.division || agentDoc?.assignedDivision || '',
            pincode: pincode || agentDoc?.pincode || '',
            address: address || territoryStr,
            registrationId,
            createdAt: new Date()
        };

        const newVendorUser = new User(vendorData);
        try {
            await newVendorUser.save();
        } catch (saveErr) {
            if (saveErr.code === 11000 || (saveErr.message && saveErr.message.includes('E11000'))) {
                const isPhoneDup = saveErr.message && (saveErr.message.includes('phone') || saveErr.message.includes('phone_1'));
                return res.status(400).json({
                    success: false,
                    msg: isPhoneDup ? 'A user with this phone number already exists.' : 'A vendor with this email address already exists.',
                    message: isPhoneDup ? 'A user with this phone number already exists.' : 'A vendor with this email address already exists.'
                });
            }
            throw saveErr;
        }

        const newVendorDoc = new Vendor({
            ...vendorData,
            _id: newVendorUser._id
        });
        await newVendorDoc.save().catch(() => {});

        const enriched = await enrichVendorData(newVendorUser);

        // Real-time Socket.IO emission to admin room
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('vendor_onboarded_by_agent', enriched);
            io.emit('vendor_onboarded_by_agent', enriched);
        }

        res.status(201).json({
            success: true,
            message: 'Vendor onboarded successfully by agent and submitted for Admin approval',
            vendor: enriched
        });
    } catch (err) {
        console.error('Agent vendor onboarding error:', err);
        res.status(500).json({ success: false, message: 'Server error onboarding vendor', error: err.message });
    }
});

// POST Auto-Assign Pincode Agent for Vendor Verification
router.post('/vendors/auto-assign-agent', auth, async (req, res) => {
    try {
        const { vendorId } = req.body;
        let vendor = await User.findById(vendorId);
        if (!vendor) {
            vendor = await User.findOne({ email: 'dhanushiyasri@gmail.com' });
        }
        if (!vendor) return res.status(404).json({ msg: 'Vendor not found' });

        const pincodeCode = vendor.address?.match(/\b\d{6}\b/)?.[0] || vendor.pincode;
        let assignedAgent = null;

        if (pincodeCode) {
            const pinDoc = await Pincode.findOne({ code: pincodeCode }).populate('activeAgentId');
            if (pinDoc && pinDoc.activeAgentId) {
                assignedAgent = pinDoc.activeAgentId;
            }
        }

        if (!assignedAgent) {
            // Fallback: Find any pincode agent in the district/state
            assignedAgent = await User.findOne({ role: 'agent', level: 'pincode', status: 'approved' });
        }

        vendor.status = 'Assigned';
        await vendor.save();

        const io = getIo(req);
        if (io) {
            io.emit('vendor_verification_assigned', {
                vendorId: vendor._id,
                businessName: vendor.businessName,
                assignedAgent: assignedAgent ? { id: assignedAgent._id, name: assignedAgent.name } : null,
                timestamp: new Date()
            });
        }

        res.json({ success: true, assignedAgent });
    } catch (err) {
        console.error('Auto assign error:', err);
        res.status(500).send('Server error');
    }
});

// Helper to construct robust query filters matching String _id, ObjectId _id, registrationId, vendorId, email, or businessName
const buildVendorQuery = (vId, em, regId, bizName) => {
    const orList = [];
    if (vId && vId !== 'undefined' && vId !== 'null') {
        orList.push({ _id: String(vId) });
        orList.push({ registrationId: String(vId) });
        orList.push({ vendorId: String(vId) });
        orList.push({ id: String(vId) });
        if (mongoose.Types.ObjectId.isValid(vId)) {
            orList.push({ _id: new mongoose.Types.ObjectId(vId) });
        }
    }
    if (regId && regId !== 'undefined' && regId !== 'null') {
        orList.push({ registrationId: String(regId) });
        orList.push({ vendorId: String(regId) });
    }
    if (em && em !== 'undefined' && em !== 'null') {
        const cleanEmail = String(em).toLowerCase().trim();
        if (cleanEmail) {
            orList.push({ email: cleanEmail });
            orList.push({ email: { $regex: new RegExp(`^${cleanEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } });
        }
    }
    if (bizName && bizName !== 'undefined' && bizName !== 'null') {
        const cleanBiz = String(bizName).trim();
        if (cleanBiz) {
            orList.push({ businessName: { $regex: new RegExp(`^${cleanBiz.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } });
            orList.push({ name: { $regex: new RegExp(`^${cleanBiz.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } });
        }
    }
    return { $or: orList.length > 0 ? orList : [{ _id: null }] };
};

// POST Update Vendor Status (Active, Inactive, Suspended, Pending, Rejected)
router.post('/vendors/update-status', auth, async (req, res) => {
    try {
        const { vendorId, registrationId, _id, email, businessName, name, status, reason = '' } = req.body;
        if (!status) return res.status(400).json({ msg: 'Status is required' });

        const rawStatus = status.trim();
        const formattedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
        const isCurrentlyActive = ['Active', 'Approved'].includes(formattedStatus);

        const targetId = _id || vendorId;
        const targetEmail = email ? String(email).toLowerCase().trim() : '';
        const targetBizName = businessName || name || '';
        const updateFilter = buildVendorQuery(targetId, targetEmail, registrationId, targetBizName);

        const existingVendor = await User.findOne(updateFilter) || await Vendor.findOne(updateFilter);
        const oldStatus = existingVendor ? (existingVendor.status || 'Pending') : 'Pending';

        const mainUpdatePayload = { 
            status: formattedStatus, 
            isActive: isCurrentlyActive, 
            isApproved: isCurrentlyActive, 
            isLocked: !isCurrentlyActive 
        };

        // 1. Update top-level status on User collection
        await User.collection.updateMany(updateFilter, { $set: mainUpdatePayload }).catch(e => console.error('User.collection update error:', e));
        await User.updateMany(updateFilter, { $set: mainUpdatePayload }).catch(e => console.error('User.updateMany error:', e));

        // 2. Update top-level status on Vendor collection
        await Vendor.collection.updateMany(updateFilter, { $set: { status: formattedStatus, isActive: isCurrentlyActive } }).catch(() => {});
        await Vendor.updateMany(updateFilter, { $set: { status: formattedStatus, isActive: isCurrentlyActive } }).catch(() => {});

        // 2b. Update all products associated with this vendor across all matching identifiers
        const matchedVendors = await User.find(updateFilter).select('_id email phone registrationId businessName name primaryBusinessId businesses');
        const matchedVendorCols = await Vendor.find(updateFilter).select('_id email phone registrationId businessName primaryBusinessId businesses');

        const validObjectIds = [];
        const stringKeys = [];

        if (targetId) {
            stringKeys.push(targetId.toString());
            if (mongoose.Types.ObjectId.isValid(targetId)) validObjectIds.push(new mongoose.Types.ObjectId(targetId));
        }
        if (registrationId) stringKeys.push(registrationId.toString());
        if (targetEmail) stringKeys.push(targetEmail.toLowerCase().trim());

        [...matchedVendors, ...matchedVendorCols].forEach(v => {
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
            if (v.businessName) stringKeys.push(v.businessName.toLowerCase().trim());
            if (v.name) stringKeys.push(v.name.toLowerCase().trim());
        });

        const rawProductColl = mongoose.connection.db.collection('products');
        await rawProductColl.updateMany(
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
                    isActive: isCurrentlyActive,
                    isAvailable: isCurrentlyActive,
                    vendorStatus: formattedStatus,
                    isVendorSuspended: !isCurrentlyActive,
                    isSuspended: !isCurrentlyActive
                }
            }
        ).catch(e => console.error('Product updateMany error on vendor status change:', e));

        // 3. Update nested businesses array with arrayFilters for documents where businesses array is non-empty
        await User.collection.updateMany(
            { ...updateFilter, "businesses": { $type: "array", $ne: [] } },
            { 
                $set: { 
                    "businesses.$[elem].status": formattedStatus,
                    "businesses.$[elem].isActive": isCurrentlyActive
                } 
            },
            { arrayFilters: [{ "elem": { $exists: true } }] }
        ).catch(e => console.error('Businesses array update error:', e));

        // 4. Update each matched vendor user document explicitly
        const vendorUsers = await User.find(updateFilter).catch(() => []);
        for (const vUser of vendorUsers) {
            vUser.status = formattedStatus;
            vUser.isActive = isCurrentlyActive;
            vUser.isApproved = isCurrentlyActive;
            vUser.isLocked = !isCurrentlyActive;
            if (!isCurrentlyActive) {
                vUser.rejectionReason = reason || `Account ${formattedStatus} by Administrator`;
            } else {
                vUser.rejectionReason = '';
            }
            if (vUser.businesses && Array.isArray(vUser.businesses)) {
                vUser.businesses.forEach(b => {
                    b.status = formattedStatus;
                    b.isActive = isCurrentlyActive;
                });
                if (typeof vUser.markModified === 'function') {
                    vUser.markModified('businesses');
                }
            }
            await vUser.save().catch(e => console.error('vUser.save error:', e));

            if (!isCurrentlyActive) {
                await SecuritySession.deleteMany({ userId: vUser._id }).catch(() => {});
                await UserSession.deleteMany({ userId: vUser._id }).catch(() => {});
                try {
                    securityManager.revokeAllUserSessions(vUser._id.toString());
                    if (vUser.email) securityManager.revokeAllUserSessions(vUser.email.toLowerCase());
                } catch (e) {}
            }
        }

        // 2. RECORD ENTERPRISE AUDIT LOG
        try {
            const adminUser = req.user ? await User.findById(req.user.id) : null;
            let actionType = 'vendor_status_changed';
            if (formattedStatus === 'Inactive') actionType = 'vendor_deactivated';
            else if (formattedStatus === 'Active' || formattedStatus === 'Approved') actionType = 'vendor_activated';
            else if (formattedStatus === 'Suspended') actionType = 'vendor_suspended';

            await AuditLog.create({
                userId: req.user ? req.user.id : null,
                userEmail: adminUser?.email || 'admin@connect.com',
                userRole: adminUser?.role || 'admin',
                action: actionType,
                ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
                status: 'success',
                details: `Admin changed status for vendor "${existingVendor?.businessName || existingVendor?.name || targetBizName || vendorId}" from "${oldStatus}" to "${formattedStatus}". Reason: ${reason || 'Status updated by Administrator'}`,
                metadata: {
                    adminId: req.user ? req.user.id : null,
                    adminName: adminUser?.name || 'Admin',
                    vendorId: existingVendor?._id || targetId,
                    vendorName: existingVendor?.businessName || existingVendor?.name || targetBizName || 'Vendor',
                    oldStatus,
                    newStatus: formattedStatus,
                    reason: reason || 'Status updated by Administrator',
                    timestamp: new Date()
                }
            });
        } catch (auditErr) {
            console.error('Audit log creation error:', auditErr);
        }

        // 3. EMIT REAL-TIME SOCKET.IO NOTIFICATIONS
        const io = getIo(req);
        if (io) {
            io.emit('vendor_status_changed', {
                vendorId: existingVendor?._id || targetId,
                email: existingVendor?.email || targetEmail,
                status: formattedStatus,
                isActive: isCurrentlyActive,
                reason,
                timestamp: new Date()
            });

            if (['Inactive', 'Suspended'].includes(formattedStatus)) {
                io.emit('session_terminated', {
                    userId: existingVendor?._id || targetId,
                    reason: 'Your vendor account has been suspended. Please contact the administrator.',
                    timestamp: new Date()
                });
            }
        }

        res.json({
            success: true,
            msg: `Vendor status updated to ${formattedStatus} successfully`,
            vendor: {
                id: existingVendor?._id || targetId,
                status: formattedStatus,
                isActive: isCurrentlyActive
            }
        });
    } catch (err) {
        console.error('Vendor update status error:', err);
        res.status(500).send('Server error');
    }
});

// POST Update Status of a Specific Business Outlet / Store
router.post('/vendors/update-business-status', auth, async (req, res) => {
    try {
        const { vendorId, email, registrationId, businessId, businessName, status, reason } = req.body;

        if (!status) {
            return res.status(400).json({ msg: 'Status is required' });
        }

        const rawStatus = status.trim();
        const formattedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
        const isCurrentlyActive = ['Active', 'Approved'].includes(formattedStatus);

        const targetId = vendorId;
        const targetEmail = email ? String(email).toLowerCase().trim() : '';
        const updateFilter = buildVendorQuery(targetId, targetEmail, registrationId, '');

        let vendorUser = await User.findOne(updateFilter);
        let legacyVendor = await Vendor.findOne(updateFilter);

        let targetBizName = businessName || '';
        const vendorIdentifiers = new Set();

        [vendorUser, legacyVendor].forEach(v => {
            if (!v) return;
            if (v._id) vendorIdentifiers.add(v._id.toString());
            if (v.registrationId) vendorIdentifiers.add(v.registrationId.toString());
            if (v.vendorId) vendorIdentifiers.add(v.vendorId.toString());
            if (v.email) vendorIdentifiers.add(v.email.toLowerCase().trim());
            if (v.phone) vendorIdentifiers.add(v.phone.replace(/\D/g, ''));
            if (v.businessName) vendorIdentifiers.add(v.businessName.toLowerCase().trim());
            if (v.name) vendorIdentifiers.add(v.name.toLowerCase().trim());

            if (Array.isArray(v.businesses)) {
                let matched = false;
                v.businesses.forEach(b => {
                    const bIdStr = b._id ? b._id.toString() : '';
                    const bNameStr = (b.businessName || b.name || '').toLowerCase().trim();
                    const targetBizIdStr = businessId ? String(businessId) : '';
                    const targetBizNameStr = targetBizName ? String(targetBizName).toLowerCase().trim() : '';

                    if ((targetBizIdStr && (bIdStr === targetBizIdStr || (bIdStr.length >= 16 && targetBizIdStr.startsWith(bIdStr.substring(0, 16))))) || (targetBizNameStr && bNameStr === targetBizNameStr)) {
                        b.status = formattedStatus;
                        b.isActive = isCurrentlyActive;
                        if (!targetBizName) targetBizName = b.businessName || b.name || '';
                        matched = true;
                    }
                });
                if (matched && typeof v.markModified === 'function') {
                    v.markModified('businesses');
                }
            }
        });

        if (vendorUser) await vendorUser.save().catch(e => console.error('vendorUser.save error:', e));
        if (legacyVendor) await legacyVendor.save().catch(e => console.error('legacyVendor.save error:', e));

        const vIdArr = Array.from(vendorIdentifiers);

        const vendorMatch = {
            $or: [
                { vendorId: { $in: vIdArr } },
                { vendorEmail: { $in: vIdArr.map(v => v.toLowerCase()) } },
                { vendorPhone: { $in: vIdArr } }
            ]
        };

        const bizMatchConds = [];
        if (businessId) {
            bizMatchConds.push({ businessId });
            bizMatchConds.push({ 'business._id': businessId });
            if (mongoose.Types.ObjectId.isValid(businessId)) {
                bizMatchConds.push({ businessId: new mongoose.Types.ObjectId(businessId) });
            }
        }
        if (targetBizName) {
            const escapedBizName = targetBizName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            bizMatchConds.push({ businessName: new RegExp('^' + escapedBizName + '$', 'i') });
            bizMatchConds.push({ subNavbarCategory: new RegExp('^' + escapedBizName + '$', 'i') });
        }

        if (bizMatchConds.length > 0) {
            await Product.updateMany(
                { $and: [vendorMatch, { $or: bizMatchConds }] },
                { $set: { businessStatus: formattedStatus.toLowerCase(), businessIsActive: isCurrentlyActive, isAvailable: isCurrentlyActive } }
            ).catch(e => console.error('Product update error for business status change:', e));
        }

        // Record Audit Log
        try {
            const adminUser = req.user ? await User.findById(req.user.id) : null;
            await AuditLog.create({
                action: 'vendor_business_status_changed',
                details: `Admin changed status of business outlet "${targetBizName || businessId}" to "${formattedStatus}" for vendor (${targetEmail || targetId})`,
                adminEmail: adminUser ? adminUser.email : 'System Admin',
                ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
                userAgent: req.headers['user-agent'] || 'System',
                metadata: { vendorId: targetId, businessId, businessName: targetBizName, newStatus: formattedStatus }
            }).catch(() => {});
        } catch (e) {}

        // Emit Socket.IO event for real-time customer app catalog update
        const io = req.app.get('io');
        if (io) {
            io.emit('vendor_status_changed', {
                vendorId: targetId,
                businessId,
                businessName: targetBizName,
                status: formattedStatus,
                isActive: isCurrentlyActive
            });
        }

        return res.json({
            success: true,
            msg: `Business outlet status successfully updated to ${formattedStatus}`,
            vendor: vendorUser || legacyVendor,
            businessId,
            businessName: targetBizName,
            status: formattedStatus,
            isActive: isCurrentlyActive
        });
    } catch (err) {
        console.error('Update business status error:', err);
        return res.status(500).send('Server error');
    }
});

// POST Approve & Activate Direct Vendor Request
router.post('/vendors/approve', auth, async (req, res) => {
    try {
        const { vendorId, registrationId, _id, email, businessName, name } = req.body;
        const targetId = _id || vendorId;
        const targetEmail = email ? String(email).toLowerCase().trim() : '';
        const targetBizName = businessName || name || '';
        const updateFilter = buildVendorQuery(targetId, targetEmail, registrationId, targetBizName);

        await User.collection.updateMany(
            updateFilter,
            { $set: { status: 'Approved', isActive: true, isApproved: true, isLocked: false, rejectionReason: '' } }
        ).catch(() => {});

        await User.updateMany(
            updateFilter,
            { $set: { status: 'Approved', isActive: true, isApproved: true, isLocked: false, rejectionReason: '' } }
        ).catch(() => {});

        await Vendor.collection.updateMany(
            updateFilter,
            { $set: { status: 'Approved', isActive: true } }
        ).catch(() => {});

        await Vendor.updateMany(
            updateFilter,
            { $set: { status: 'Approved', isActive: true } }
        ).catch(() => {});

        let user = await User.findOne(updateFilter);
        if (user) {
            user.status = 'Approved';
            user.isActive = true;
            user.isApproved = true;
            user.isLocked = false;
            user.rejectionReason = '';
            await user.save().catch(() => {});
        } else if (targetEmail || targetBizName) {
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash('Vendor@12345', salt);
            user = new User({
                name: name || targetBizName || 'Vendor Partner',
                businessName: targetBizName || name || 'Vendor Partner',
                email: targetEmail || `vendor_${Date.now()}@connect.com`,
                phone: (targetPhone || '').replace(/\D/g, '') || undefined,
                password: hashedPassword,
                role: 'vendor',
                status: 'Approved',
                isActive: true,
                isApproved: true,
                isLocked: false,
                createdAt: new Date()
            });
            await user.save().catch((err) => {
                console.error("Vendor auto-user creation warning:", err.message);
            });
        }

        // Record Audit Log
        try {
            const adminUser = req.user ? await User.findById(req.user.id) : null;
            await AuditLog.create({
                userId: req.user ? req.user.id : null,
                userEmail: adminUser?.email || 'admin@connect.com',
                userRole: adminUser?.role || 'admin',
                action: 'vendor_activated',
                ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
                status: 'success',
                details: `Admin approved vendor "${user?.businessName || user?.name || targetBizName}" (${user?.email || targetEmail})`,
                metadata: {
                    adminId: req.user ? req.user.id : null,
                    adminName: adminUser?.name || 'Admin',
                    vendorId: user?._id || targetId,
                    vendorName: user?.businessName || user?.name || targetBizName,
                    oldStatus: 'Pending',
                    newStatus: 'Approved',
                    reason: 'Direct registration approved',
                    timestamp: new Date()
                }
            });
        } catch (e) {}

        const io = getIo(req);
        if (io) {
            io.emit('vendor_approved', {
                vendorId: user?._id || targetId,
                email: user?.email || targetEmail,
                status: 'Approved',
                timestamp: new Date()
            });
        }

        res.json({ success: true, msg: 'Vendor approved and activated successfully', user: { id: user?._id || targetId, email: user?.email || targetEmail, status: 'Approved' } });
    } catch (err) {
        console.error('Approve vendor error:', err);
        res.status(500).send('Server error');
    }
});

// POST Reject Direct Vendor Request
router.post('/vendors/reject', auth, async (req, res) => {
    try {
        const { vendorId, registrationId, _id, email, businessName, name, reason = 'Registration application rejected' } = req.body;
        const targetId = _id || vendorId;
        const targetEmail = email ? String(email).toLowerCase().trim() : '';
        const targetBizName = businessName || name || '';
        const updateFilter = buildVendorQuery(targetId, targetEmail, registrationId, targetBizName);

        await User.collection.updateMany(
            updateFilter,
            { $set: { status: 'Rejected', isActive: false, isLocked: true, rejectionReason: reason } }
        ).catch(() => {});

        await User.updateMany(
            updateFilter,
            { $set: { status: 'Rejected', isActive: false, isLocked: true, rejectionReason: reason } }
        ).catch(() => {});

        await Vendor.collection.updateMany(
            updateFilter,
            { $set: { status: 'Rejected', isActive: false } }
        ).catch(() => {});

        await Vendor.updateMany(
            updateFilter,
            { $set: { status: 'Rejected', isActive: false } }
        ).catch(() => {});

        let existingVendor = await User.findOne(updateFilter);
        if (existingVendor) {
            await SecuritySession.deleteMany({ userId: existingVendor._id }).catch(() => {});
            await UserSession.deleteMany({ userId: existingVendor._id }).catch(() => {});
        }

        // Record Audit Log
        try {
            const adminUser = req.user ? await User.findById(req.user.id) : null;
            await AuditLog.create({
                userId: req.user ? req.user.id : null,
                userEmail: adminUser?.email || 'admin@connect.com',
                userRole: adminUser?.role || 'admin',
                action: 'vendor_status_changed',
                ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
                status: 'success',
                details: `Admin rejected vendor "${existingVendor?.businessName || existingVendor?.name || vendorId}". Reason: ${reason}`,
                metadata: {
                    adminId: req.user ? req.user.id : null,
                    adminName: adminUser?.name || 'Admin',
                    vendorId: existingVendor?._id || vendorId,
                    vendorName: existingVendor?.businessName || existingVendor?.name || 'Vendor',
                    oldStatus: 'Pending',
                    newStatus: 'Rejected',
                    reason,
                    timestamp: new Date()
                }
            });
        } catch (e) {}

        const io = getIo(req);
        if (io) {
            io.emit('vendor_rejected', {
                vendorId,
                status: 'Rejected',
                timestamp: new Date()
            });
            if (existingVendor) {
                io.emit('session_terminated', {
                    userId: existingVendor._id,
                    reason: 'Your vendor account registration was rejected by the administrator.',
                    timestamp: new Date()
                });
            }
        }

        res.json({ success: true, msg: 'Vendor rejected successfully' });
    } catch (err) {
        console.error('Reject vendor error:', err);
        res.status(500).send('Server error');
    }
});

// DELETE Vendor by ID or Email
router.delete('/vendors/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.query;
        const deleteFilter = buildVendorQuery(id, email);

        await User.collection.deleteMany(deleteFilter).catch(() => {});
        await User.deleteMany(deleteFilter).catch(() => {});
        await Vendor.collection.deleteMany(deleteFilter).catch(() => {});
        await Vendor.deleteMany(deleteFilter).catch(() => {});

        const io = getIo(req);
        if (io) {
            io.emit('vendor_deleted', { vendorId: id, email, timestamp: new Date() });
        }

        res.json({ success: true, msg: 'Vendor deleted successfully' });
    } catch (err) {
        console.error('Delete vendor error:', err);
        res.status(500).send('Server error');
    }
});

router.post('/vendors/delete', auth, async (req, res) => {
    try {
        const { vendorId, email } = req.body;
        const deleteFilter = buildVendorQuery(vendorId, email);

        await User.collection.deleteMany(deleteFilter).catch(() => {});
        await User.deleteMany(deleteFilter).catch(() => {});
        await Vendor.collection.deleteMany(deleteFilter).catch(() => {});
        await Vendor.deleteMany(deleteFilter).catch(() => {});

        const io = getIo(req);
        if (io) {
            io.emit('vendor_deleted', { vendorId, email, timestamp: new Date() });
        }

        res.json({ success: true, msg: 'Vendor deleted successfully' });
    } catch (err) {
        console.error('Delete vendor error:', err);
        res.status(500).send('Server error');
    }
});


// =========================================================
// 2. MEMBERSHIP CARD MANAGEMENT
// =========================================================

// GET Membership Requests
router.get('/membership-requests', auth, async (req, res) => {
    try {
        const { membershipType, paymentMode, paymentStatus, status, search } = req.query;
        const filter = {};

        if (membershipType && membershipType !== 'all') filter.membershipType = membershipType;
        if (paymentMode && paymentMode !== 'all') filter.paymentMode = paymentMode;
        if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
        if (status && status !== 'all') filter.status = status;

        if (search) {
            filter.$or = [
                { customerName: { $regex: new RegExp(search, 'i') } },
                { customerEmail: { $regex: new RegExp(search, 'i') } },
                { customerPhone: { $regex: new RegExp(search, 'i') } },
                { membershipId: { $regex: new RegExp(search, 'i') } }
            ];
        }

        const requests = await MembershipRequest.find(filter).sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        console.error('Fetch membership requests error:', err);
        res.status(500).send('Server error');
    }
});

// POST Create Membership Card Request (simulates customer purchase)
router.post('/membership-requests/create', auth, async (req, res) => {
    try {
        const { customerName, customerEmail, customerPhone, membershipType, paymentMode, amount } = req.body;
        const membershipId = `MEM-${Date.now().toString().slice(-6)}`;
        const validityStartDate = new Date();
        const validityExpiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

        const newRequest = new MembershipRequest({
            customerName,
            customerEmail,
            customerPhone,
            membershipId,
            membershipType: membershipType || 'Silver',
            paymentMode: paymentMode || 'UPI',
            paymentStatus: 'Paid',
            validityStartDate,
            validityExpiryDate,
            amount: amount || 999,
            status: 'Pending'
        });

        await newRequest.save();

        const io = getIo(req);
        if (io) {
            io.emit('membership_purchased', newRequest);
            io.emit('payment_received', { amount: newRequest.amount, type: 'Membership Revenue' });
        }

        res.status(201).json(newRequest);
    } catch (err) {
        console.error('Create membership request error:', err);
        res.status(500).send('Server error');
    }
});

// POST Approve / Reject Membership Request
router.post('/membership-requests/action', auth, async (req, res) => {
    try {
        const { requestId, status } = req.body; // Approved or Rejected
        const request = await MembershipRequest.findById(requestId);
        if (!request) return res.status(404).json({ msg: 'Request not found' });

        request.status = status;
        await request.save();

        const io = getIo(req);
        if (io) {
            io.emit('membership_updated', request);
        }

        res.json({ msg: `Membership card ${status.toLowerCase()} successfully`, request });
    } catch (err) {
        console.error('Membership action error:', err);
        res.status(500).send('Server error');
    }
});


// =========================================================
// 3. ENTERPRISE PAYMENT DASHBOARD
// =========================================================

// GET 13 KPI Cards Payment Overview
router.get('/payments/kpi', auth, async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        // Aggregate real transactions / payments from MongoDB
        const completedOrders = await Order.find({ status: { $nin: ['cancelled', 'Cancelled', 'rejected', 'Rejected'] } });
        const pendingOrders = await Order.find({ status: { $in: ['pending', 'Pending'] } });
        const membershipReqs = await MembershipRequest.find({ paymentStatus: 'Paid' });
        const payrolls = await PayrollRecord.find({ paymentStatus: 'Paid' });

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

        const totalOrderRevenue = completedOrders.reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || o.amount || 0), 0);
        const membershipRevenue = membershipReqs.reduce((acc, m) => acc + Number(m.amount || 0), 0);

        const totalRevenue = totalOrderRevenue + membershipRevenue;

        const todayRevenue = completedOrders
            .filter(o => o.createdAt && new Date(o.createdAt) >= startOfToday)
            .reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || o.amount || 0), 0);

        const monthlyRevenue = completedOrders
            .filter(o => o.createdAt && new Date(o.createdAt) >= startOfMonth)
            .reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || o.amount || 0), 0);

        const customerPayments = totalOrderRevenue;
        const vendorRegFees = 0;
        const vendorTieupFees = 0;
        const agentFees = 0;
        const commissionPaid = payrolls.reduce((acc, p) => acc + Number(p.commission || 0), 0);
        const salaryPaid = payrolls.reduce((acc, p) => acc + Number(p.netSalary || 0), 0);
        const expenses = 0;
        const balance = totalRevenue - (commissionPaid + salaryPaid + expenses);
        const pendingPayments = pendingOrders.reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || o.amount || 0), 0);

        res.json({
            totalRevenue,
            todayRevenue,
            monthlyRevenue,
            customerPayments,
            vendorRegFees,
            vendorTieupFees,
            membershipRevenue,
            agentFees,
            commissionPaid,
            salaryPaid,
            expenses,
            balance,
            pendingPayments
        });
    } catch (err) {
        console.error('Payment KPI error:', err);
        res.status(500).send('Server error');
    }
});


// =========================================================
// 4. PAYROLL MANAGEMENT
// =========================================================

// GET Payroll Records (Aggregates Employees, Agents, Vendors, Delivery Partners, Technicians)
router.get('/payroll', auth, async (req, res) => {
    try {
        const { department, role, employeeType, status, search } = req.query;

        // Fetch explicitly generated PayrollRecords
        let payrolls = await PayrollRecord.find({}).sort({ createdAt: -1 });

        // Map existing payroll codes for quick lookup
        const existingCodes = new Set(payrolls.map(p => p.employeeCode || p.employeeName));

        const isAgentFilter = (employeeType && employeeType.toLowerCase() === 'agent') || (role && role.toLowerCase().includes('agent'));
        const isEmployeeFilter = (employeeType && employeeType.toLowerCase() === 'employee');
        const isCommissionFilter = (employeeType && (employeeType.toLowerCase() === 'commission' || employeeType.toLowerCase() === 'commission based'));

        // 1. Fetch Agents (Users with role='agent' or level)
        if (!isEmployeeFilter && !isCommissionFilter) {
            const agents = await User.find({ role: { $in: ['agent', 'Agent'] } });
            agents.forEach((a, idx) => {
                const code = a.registrationId || `AGT-${1000 + idx}`;
                if (!existingCodes.has(code) && !existingCodes.has(a.name)) {
                    const comm = a.commissionEarned || 0;
                    const baseSal = 28000;
                    const net = baseSal + comm - 2500;
                    payrolls.push({
                        _id: `agt-${a._id}`,
                        employeeName: a.name || 'Agent',
                        employeeCode: code,
                        role: `${(a.level || 'Pincode').toUpperCase()} Agent`,
                        department: 'Agent Operations',
                        employeeType: 'Agent',
                        salary: baseSal,
                        bonus: 0,
                        commission: comm,
                        incentive: 0,
                        pf: 1800,
                        esi: 500,
                        professionalTax: 200,
                        advance: 0,
                        deduction: 0,
                        netSalary: net,
                        paymentStatus: (a.isActive || a.status === 'approved') ? 'Paid' : 'Pending',
                        month: 'August',
                        year: 2026
                    });
                }
            });
        }

        // 2. Fetch Vendors
        if (!isAgentFilter && !isEmployeeFilter) {
            const vendors = await User.find({ role: { $in: ['vendor', 'Vendor'] } });
            vendors.forEach((v, idx) => {
                const code = v.registrationId || `VND-${2000 + idx}`;
                if (!existingCodes.has(code) && !existingCodes.has(v.businessName || v.name)) {
                    payrolls.push({
                        _id: `vnd-${v._id}`,
                        employeeName: v.businessName || v.name || 'Vendor Partner',
                        employeeCode: code,
                        role: 'Merchant Partner',
                        department: 'Vendor Network',
                        employeeType: 'Commission Based',
                        salary: 0,
                        bonus: 0,
                        commission: 15000,
                        incentive: 0,
                        pf: 0,
                        esi: 0,
                        professionalTax: 200,
                        advance: 0,
                        deduction: 0,
                        netSalary: 14800,
                        paymentStatus: 'Paid',
                        month: 'August',
                        year: 2026
                    });
                }
            });
        }

        // 3. Fetch Support Employees
        if (!isAgentFilter && !isCommissionFilter) {
            const supportEmps = await SupportTeam.find({});
            supportEmps.forEach((s, idx) => {
                const code = s.employeeId || `SUP-${3000 + idx}`;
                if (!existingCodes.has(code) && !existingCodes.has(s.name)) {
                    payrolls.push({
                        _id: `sup-${s._id}`,
                        employeeName: s.name,
                        employeeCode: code,
                        role: s.designation || 'Staff',
                        department: s.department || 'Customer Support',
                        employeeType: 'Employee',
                        salary: s.salary || 32000,
                        bonus: 0,
                        commission: 0,
                        incentive: 0,
                        pf: 1800,
                        esi: 500,
                        professionalTax: 200,
                        advance: 0,
                        deduction: 0,
                        netSalary: (s.salary || 32000) - 2500,
                        paymentStatus: 'Paid',
                        month: 'August',
                        year: 2026
                    });
                }
            });
        }

        // 4. Fetch Delivery Partners
        if (!isAgentFilter && !isEmployeeFilter) {
            const delPartners = await DeliveryPartner.find({});
            delPartners.forEach((d, idx) => {
                const code = `DEL-${4000 + idx}`;
                if (!existingCodes.has(code) && !existingCodes.has(d.name)) {
                    payrolls.push({
                        _id: `del-${d._id}`,
                        employeeName: d.name,
                        employeeCode: code,
                        role: 'Delivery Executive',
                        department: 'Logistics',
                        employeeType: 'Commission Based',
                        salary: 18000,
                        bonus: 0,
                        commission: 5000,
                        incentive: 0,
                        pf: 1200,
                        esi: 300,
                        professionalTax: 200,
                        advance: 0,
                        deduction: 0,
                        netSalary: 21300,
                        paymentStatus: 'Paid',
                        month: 'August',
                        year: 2026
                    });
                }
            });
        }

        // 5. Fetch Technicians
        if (!isAgentFilter && !isCommissionFilter) {
            const technicians = await CardHolder.find({});
            technicians.forEach((t, idx) => {
                const code = t.cardNumber || `TEC-${5000 + idx}`;
                if (!existingCodes.has(code) && !existingCodes.has(t.name)) {
                    payrolls.push({
                        _id: `tec-${t._id}`,
                        employeeName: t.name,
                        employeeCode: code,
                        role: 'Technical Specialist',
                        department: 'Technical Support',
                        employeeType: 'Employee',
                        salary: 26000,
                        bonus: 0,
                        commission: 3000,
                        incentive: 0,
                        pf: 1500,
                        esi: 400,
                        professionalTax: 200,
                        advance: 0,
                        deduction: 0,
                        netSalary: 26900,
                        paymentStatus: 'Paid',
                        month: 'August',
                        year: 2026
                    });
                }
            });
        }

        // Apply filters
        if (department && department !== 'all') {
            payrolls = payrolls.filter(p => (p.department || '').toLowerCase() === department.toLowerCase());
        }
        if (role && role !== 'all') {
            payrolls = payrolls.filter(p => (p.role || '').toLowerCase().includes(role.toLowerCase()));
        }
        if (employeeType && employeeType !== 'all') {
            payrolls = payrolls.filter(p => (p.employeeType || '').toLowerCase() === employeeType.toLowerCase());
        }
        if (status && status !== 'all') {
            payrolls = payrolls.filter(p => (p.paymentStatus || '').toLowerCase() === status.toLowerCase());
        }

        if (search) {
            const s = search.toLowerCase();
            payrolls = payrolls.filter(p =>
                (p.employeeName || '').toLowerCase().includes(s) ||
                (p.employeeCode || '').toLowerCase().includes(s) ||
                (p.department || '').toLowerCase().includes(s)
            );
        }

        // Calculate KPI summaries dynamically
        const totalSalary = payrolls.reduce((acc, p) => acc + (p.salary || 0), 0);
        const commissionPaid = payrolls.reduce((acc, p) => acc + (p.commission || 0), 0);
        const pendingSalary = payrolls.filter(p => p.paymentStatus === 'Pending').reduce((acc, p) => acc + (p.netSalary || 0), 0);
        const currentMonthPayroll = payrolls.reduce((acc, p) => acc + (p.netSalary || 0), 0);

        res.json({
            payrolls,
            kpi: {
                totalSalary,
                commissionPaid,
                pendingSalary,
                currentMonthPayroll
            }
        });
    } catch (err) {
        console.error('Fetch payroll error:', err);
        res.status(500).send('Server error');
    }
});

// POST Generate / Process Payroll Entry
router.post('/payroll/generate', auth, async (req, res) => {
    try {
        const {
            employeeName, employeeCode, role, department, employeeType,
            salary = 0, bonus = 0, commission = 0, incentive = 0,
            pf = 0, esi = 0, professionalTax = 0, advance = 0, deduction = 0,
            month = 'August', year = 2026
        } = req.body;

        const grossSalary = Number(salary) + Number(bonus) + Number(commission) + Number(incentive);
        const totalDeductions = Number(pf) + Number(esi) + Number(professionalTax) + Number(advance) + Number(deduction);
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        const newPayroll = new PayrollRecord({
            employeeName,
            employeeCode: employeeCode || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
            role: role || 'Staff',
            department: department || 'Customer Support',
            employeeType: employeeType || 'Employee',
            salary: Number(salary),
            bonus: Number(bonus),
            commission: Number(commission),
            incentive: Number(incentive),
            pf: Number(pf),
            esi: Number(esi),
            professionalTax: Number(professionalTax),
            advance: Number(advance),
            deduction: Number(deduction),
            netSalary,
            paymentStatus: 'Paid',
            month,
            year
        });

        await newPayroll.save();

        const io = getIo(req);
        if (io) {
            io.emit('payroll_generated', newPayroll);
        }

        res.status(201).json(newPayroll);
    } catch (err) {
        console.error('Generate payroll error:', err);
        res.status(500).send('Server error');
    }
});


// =========================================================
// 5. CUSTOMER SUPPORT TEAM (EMPLOYEE MANAGEMENT)
// =========================================================

// GET Support Team Hierarchy
router.get('/support-team/hierarchy', auth, async (req, res) => {
    try {
        const employees = await SupportTeam.find({}).sort({ createdAt: -1 });

        const grouped = {
            'Customer Support': { manager: null, teamLeaders: [], staff: [] },
            'KYC Team': { manager: null, teamLeaders: [], staff: [] },
            'Payment Team': { manager: null, teamLeaders: [], staff: [] }
        };

        employees.forEach(emp => {
            const dept = emp.department || 'Customer Support';
            if (!grouped[dept]) grouped[dept] = { manager: null, teamLeaders: [], staff: [] };

            if (emp.designation === 'Manager') grouped[dept].manager = emp;
            else if (emp.designation === 'Team Leader') grouped[dept].teamLeaders.push(emp);
            else grouped[dept].staff.push(emp);
        });

        res.json({ employees, hierarchy: grouped });
    } catch (err) {
        console.error('Fetch support team hierarchy error:', err);
        res.status(500).send('Server error');
    }
});

// POST Onboard New Support Employee
router.post('/support-team/onboard', auth, async (req, res) => {
    try {
        const {
            name, email, phone, department, designation,
            reportingManager, reportingTL, joiningDate, salary, photo
        } = req.body;

        const employeeId = `SUP-${Math.floor(1000 + Math.random() * 9000)}`;

        const newEmp = new SupportTeam({
            employeeId,
            name,
            email,
            phone,
            department: department || 'Customer Support',
            designation: designation || 'Staff',
            reportingManager: reportingManager || null,
            reportingTL: reportingTL || null,
            joiningDate: joiningDate || new Date(),
            salary: salary || 25000,
            photo: photo || '',
            status: 'active'
        });

        await newEmp.save();

        const io = getIo(req);
        if (io) {
            io.emit('employee_onboarded', newEmp);
        }

        res.status(201).json(newEmp);
    } catch (err) {
        console.error('Onboard support employee error:', err);
        res.status(500).send('Server error');
    }
});

module.exports = router;
