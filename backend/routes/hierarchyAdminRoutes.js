const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const auth = require('../middleware/auth');
const territoryScope = require('../middleware/territoryScope');

const User = require('../models/User');
const Manager = require('../models/Manager');
const ManagerRequest = require('../models/ManagerRequest');
const State = require('../models/State');
const District = require('../models/District');
const Division = require('../models/Division');
const Pincode = require('../models/Pincode');

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
    "Uttarakhand", "West Bengal", "Delhi", "Puducherry"
];

// MANAGER LIMITS CONFIGURATION
const MANAGER_LIMITS = {
    state: 8,
    district: 2,
    division: 2,
    pincode: 2
};

// Helper to determine hierarchy rank
const getTierRank = (tier) => {
    switch ((tier || '').toLowerCase()) {
        case 'main':
        case 'super-admin':
        case 'superadmin':
            return 5;
        case 'state':
        case 'state-admin':
            return 4;
        case 'district':
        case 'district-admin':
        case 'branch-admin':
            return 3;
        case 'division':
        case 'division-admin':
            return 2;
        case 'pincode':
        case 'pincode-admin':
            return 1;
        default:
            return 0;
    }
};

// Helper: Normalize Admin document for client consumption
const formatAdminForResponse = async (adminDoc, parentMap = new Map(), countsMap = {}) => {
    const adminObj = { ...adminDoc };
    const level = adminDoc.adminLevel || adminDoc.level || (adminDoc.adminRole === 'super-admin' ? 'main' : 'pincode');
    
    // Resolve Parent Admin Name & Role
    let parentInfo = null;
    if (adminDoc.parentAdminId) {
        const pKey = String(adminDoc.parentAdminId);
        if (parentMap.has(pKey)) {
            const p = parentMap.get(pKey);
            parentInfo = {
                id: p._id,
                name: p.name,
                email: p.email,
                role: p.adminRole || p.role
            };
        }
    }

    const adminIdStr = String(adminDoc._id);
    const childAdminCount = countsMap.adminChildren?.[adminIdStr] || 0;
    const managerCount = countsMap.managersUnder?.[adminIdStr] || 0;

    return {
        _id: adminDoc._id,
        name: adminDoc.name,
        email: adminDoc.email,
        phone: adminDoc.phone || '—',
        altPhone: adminDoc.altPhone || '',
        role: adminDoc.role || 'admin',
        adminRole: adminDoc.adminRole || 'staff',
        adminLevel: level,
        status: adminDoc.status === 'Active' || adminDoc.status === 'approved' || adminDoc.isActive ? 'Active' : (adminDoc.status || 'Inactive'),
        isActive: adminDoc.isActive !== false,
        assignedState: adminDoc.assignedState || adminDoc.state || '—',
        assignedDistrict: adminDoc.assignedDistrict || adminDoc.district || '—',
        assignedDivision: adminDoc.assignedDivision || adminDoc.division || '—',
        assignedPincode: adminDoc.assignedPincode ? String(adminDoc.assignedPincode) : (adminDoc.pincode || '—'),
        postOffice: adminDoc.postOffice || '—',
        address: adminDoc.fullAddress || adminDoc.address || '',
        registrationId: adminDoc.registrationId || `ADM-${String(adminDoc._id).slice(-6).toUpperCase()}`,
        parentAdmin: parentInfo,
        parentAdminId: adminDoc.parentAdminId,
        childAdminCount,
        managerCount,
        lastLogin: adminDoc.lastLogin || null,
        createdAt: adminDoc.createdAt
    };
};

// ============================================================
// 1. GET HIERARCHICAL ADMINS (SCOPED BY CALLER TERRITORY)
// ============================================================
router.get('/hierarchy-admins', [auth, territoryScope], async (req, res) => {
    try {
        const { search, role, status } = req.query;
        const territoryFilter = req.territoryFilter || {};

        // Base query: fetch users with admin privileges
        const query = {
            $or: [
                { role: { $in: ['admin', 'super-admin'] } },
                { adminRole: { $in: ['super-admin', 'state-admin', 'district-admin', 'division-admin', 'pincode-admin', 'branch-admin'] } }
            ]
        };

        // Apply territory isolation filter if not super admin
        if (!req.adminUser.isMainAdmin) {
            Object.assign(query, territoryFilter);
            // Hide Main Admin records from lower tier admins
            query.adminRole = { $ne: 'super-admin' };
            query.role = { $ne: 'super-admin' };
            query.email = { $ne: 'admin@example.com' };
        }

        if (status && status !== 'All') {
            if (status === 'Active') {
                query.$and = (query.$and || []).concat([{
                    $or: [{ status: 'Active' }, { status: 'approved' }, { isActive: true }]
                }]);
            } else {
                query.status = status;
            }
        }

        if (role && role !== 'All') {
            const roleRegex = new RegExp(`^${role}$`, 'i');
            query.$and = (query.$and || []).concat([{
                $or: [{ adminRole: roleRegex }, { adminLevel: roleRegex }, { level: roleRegex }]
            }]);
        }

        let adminDocs = await User.find(query)
            .select('name email phone altPhone role adminRole adminLevel level assignedState assignedDistrict assignedDivision assignedPincode postOffice fullAddress address status isActive parentAdminId registrationId lastLogin createdAt')
            .sort({ createdAt: -1 })
            .lean();

        // Search in-memory for name, email, phone, territory
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            adminDocs = adminDocs.filter(a =>
                (a.name && a.name.toLowerCase().includes(q)) ||
                (a.email && a.email.toLowerCase().includes(q)) ||
                (a.phone && a.phone.includes(q)) ||
                (a.assignedState && a.assignedState.toLowerCase().includes(q)) ||
                (a.assignedDistrict && a.assignedDistrict.toLowerCase().includes(q)) ||
                (a.assignedDivision && a.assignedDivision.toLowerCase().includes(q)) ||
                (String(a.assignedPincode || '').includes(q))
            );
        }

        // Preload parents to avoid N+1 lookups
        const parentIds = adminDocs.map(a => a.parentAdminId).filter(Boolean);
        const parents = parentIds.length > 0 ? await User.find({ _id: { $in: parentIds } }).select('name email adminRole role').lean() : [];
        const parentMap = new Map();
        parents.forEach(p => parentMap.set(String(p._id), p));

        // Preload managers for count calculations
        const managerFilter = !req.adminUser.isMainAdmin ? territoryFilter : {};
        const managers = await Manager.find(managerFilter).select('level assignedState assignedDistrict assignedDivision assignedPincode parentAdminId status').lean();

        // Calculate counts map
        const countsMap = {
            adminChildren: {},
            managersUnder: {}
        };

        // Group child admins by parentAdminId and by territory
        adminDocs.forEach(a => {
            if (a.parentAdminId) {
                const pId = String(a.parentAdminId);
                countsMap.adminChildren[pId] = (countsMap.adminChildren[pId] || 0) + 1;
            }
        });

        // Group managers by territory and direct parent
        managers.forEach(m => {
            if (m.parentAdminId) {
                const pId = String(m.parentAdminId);
                countsMap.managersUnder[pId] = (countsMap.managersUnder[pId] || 0) + 1;
            }
            // Also attribute managers by territory to the corresponding admin
            adminDocs.forEach(a => {
                const aLevel = (a.adminLevel || a.level || '').toLowerCase();
                const aState = (a.assignedState || '').toLowerCase();
                const aDist = (a.assignedDistrict || '').toLowerCase();
                const aDiv = (a.assignedDivision || '').toLowerCase();
                const aPin = String(a.assignedPincode || '');

                const mState = (m.assignedState || '').toLowerCase();
                const mDist = (m.assignedDistrict || '').toLowerCase();
                const mDiv = (m.assignedDivision || '').toLowerCase();
                const mPin = String(m.assignedPincode || '');

                if (aLevel === 'state' && aState && aState === mState) {
                    countsMap.managersUnder[String(a._id)] = (countsMap.managersUnder[String(a._id)] || 0) + 1;
                } else if (aLevel === 'district' && aDist && aDist === mDist && aState === mState) {
                    countsMap.managersUnder[String(a._id)] = (countsMap.managersUnder[String(a._id)] || 0) + 1;
                } else if (aLevel === 'division' && aDiv && aDiv === mDiv && aDist === mDist) {
                    countsMap.managersUnder[String(a._id)] = (countsMap.managersUnder[String(a._id)] || 0) + 1;
                } else if (aLevel === 'pincode' && aPin && aPin === mPin) {
                    countsMap.managersUnder[String(a._id)] = (countsMap.managersUnder[String(a._id)] || 0) + 1;
                }
            });
        });

        const formattedAdmins = await Promise.all(
            adminDocs.map(a => formatAdminForResponse(a, parentMap, countsMap))
        );

        res.json({
            success: true,
            admins: formattedAdmins,
            currentUserTier: req.adminUser.adminTier,
            isMainAdmin: req.adminUser.isMainAdmin,
            total: formattedAdmins.length
        });
    } catch (err) {
        console.error('Fetch hierarchy admins error:', err);
        res.status(500).json({ msg: 'Server error retrieving administrators', error: err.message });
    }
});

// ============================================================
// 2. CREATE HIERARCHY ADMIN (STRICT ONBOARDING ACCESS CONTROL)
// ============================================================
router.post('/hierarchy-admins', [auth, territoryScope], async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            altPhone,
            password,
            adminLevel,
            assignedState,
            assignedDistrict,
            assignedDivision,
            assignedPincode,
            address,
            postOffice,
            status = 'Active'
        } = req.body;

        if (!name || !name.trim()) return res.status(400).json({ msg: 'Full Name is required' });
        if (!email || !email.trim()) return res.status(400).json({ msg: 'Email is required' });
        if (!password || password.length < 6) return res.status(400).json({ msg: 'Password of at least 6 characters is required' });
        if (!adminLevel) return res.status(400).json({ msg: 'Admin Level is required' });

        const targetLevel = adminLevel.toLowerCase().trim();
        const callerRank = getTierRank(req.adminUser.adminTier);
        const targetRank = getTierRank(targetLevel);

        // 1. STATE ADMIN CREATION CHECK: ONLY MAIN ADMIN CAN CREATE STATE ADMIN
        if (targetLevel === 'state') {
            if (!req.adminUser.isMainAdmin) {
                return res.status(403).json({
                    msg: 'Unauthorized. ONLY the Main Admin can onboard State Administrators.',
                    message: 'Access restricted to Main Admin'
                });
            }
            if (!assignedState || !assignedState.trim()) {
                return res.status(400).json({ msg: 'Assigned State is required for State Admin.' });
            }
        }

        // 2. HIERARCHICAL RANK CHECK: CANNOT CREATE ADMIN AT SAME OR HIGHER TIER
        if (targetRank >= callerRank && !req.adminUser.isMainAdmin) {
            return res.status(403).json({
                msg: `Access denied. A ${req.adminUser.adminTier} Admin cannot create a ${targetLevel} Admin.`,
                message: 'Invalid administrative hierarchy permission'
            });
        }

        // 3. STRICT TERRITORY INHERITANCE / ENFORCEMENT
        let finalState = (assignedState || '').trim();
        let finalDistrict = (assignedDistrict || '').trim();
        let finalDivision = (assignedDivision || '').trim();
        let finalPincode = (assignedPincode || '').trim();

        if (!req.adminUser.isMainAdmin) {
            // Force state to match caller's state
            if (req.adminUser.assignedState) {
                finalState = req.adminUser.assignedState;
            }
            // If caller is District Admin, force district
            if (req.adminUser.adminTier === 'district' && req.adminUser.assignedDistrict) {
                finalDistrict = req.adminUser.assignedDistrict;
            }
            // If caller is Division Admin, force division
            if (req.adminUser.adminTier === 'division' && req.adminUser.assignedDivision) {
                finalDistrict = req.adminUser.assignedDistrict;
                finalDivision = req.adminUser.assignedDivision;
            }
        }

        // Validate mandatory territory fields per tier
        if (targetLevel === 'district' && (!finalState || !finalDistrict)) {
            return res.status(400).json({ msg: 'State and District are required for District Admin' });
        }
        if (targetLevel === 'division' && (!finalState || !finalDistrict || !finalDivision)) {
            return res.status(400).json({ msg: 'State, District, and Division are required for Division Admin' });
        }
        if (targetLevel === 'pincode' && (!finalState || !finalPincode)) {
            return res.status(400).json({ msg: 'State and Pincode are required for Pincode Admin' });
        }

        // 4. DUPLICATE CHECK
        const cleanEmail = email.toLowerCase().trim();
        const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';

        const existingUser = await User.findOne({
            $or: [
                { email: cleanEmail },
                ...(cleanPhone ? [{ phone: cleanPhone }, { phone }] : [])
            ]
        });

        if (existingUser) {
            return res.status(400).json({
                msg: existingUser.email === cleanEmail ? 'An account with this email already exists.' : 'An account with this mobile number already exists.'
            });
        }

        // 5. AUTO-ENSURE STATE IN STATE COLLECTION IF NOT EXISTS
        if (finalState) {
            const stateExists = await State.findOne({ name: new RegExp(`^${finalState}$`, 'i') });
            if (!stateExists) {
                const cleanCode = finalState.slice(0, 3).toUpperCase();
                await State.create({
                    stateId: `ST-${cleanCode}-${Date.now().toString().slice(-4)}`,
                    name: finalState,
                    code: cleanCode,
                    status: 'Active'
                }).catch(() => {});
            }
        }

        // 6. GENERATE REGISTRATION ID & ROLE
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randDigits = Math.floor(1000 + Math.random() * 9000);
        const registrationId = `ADM-${targetLevel.slice(0, 3).toUpperCase()}-${dateStr}-${randDigits}`;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newAdmin = new User({
            name: name.trim(),
            email: cleanEmail,
            phone: cleanPhone || undefined,
            altPhone: altPhone ? String(altPhone).trim() : '',
            password: hashedPassword,
            role: 'admin',
            adminRole: `${targetLevel}-admin`,
            adminLevel: targetLevel,
            assignedState: finalState,
            assignedDistrict: finalDistrict,
            assignedDivision: finalDivision,
            assignedPincode: finalPincode,
            postOffice: postOffice || '',
            fullAddress: address || '',
            status: status === 'Active' ? 'approved' : status,
            isActive: status === 'Active',
            parentAdminId: req.adminUser._id,
            registrationId,
            createdAt: new Date()
        });

        await newAdmin.save();

        res.status(201).json({
            success: true,
            msg: `${targetLevel.charAt(0).toUpperCase() + targetLevel.slice(1)} Admin created successfully.`,
            admin: await formatAdminForResponse(newAdmin.toObject())
        });
    } catch (err) {
        console.error('Create hierarchy admin error:', err);
        res.status(500).json({ msg: 'Server error creating administrator', error: err.message });
    }
});

// ============================================================
// 3. UPDATE HIERARCHY ADMIN STATUS & DETAILS
// ============================================================
router.put('/hierarchy-admins/:id', [auth, territoryScope], async (req, res) => {
    try {
        const targetAdmin = await User.findById(req.params.id);
        if (!targetAdmin) {
            return res.status(404).json({ msg: 'Administrator not found' });
        }

        // Verify territory permissions
        if (!req.adminUser.isMainAdmin) {
            const callerState = (req.adminUser.assignedState || '').toLowerCase();
            const targetState = (targetAdmin.assignedState || '').toLowerCase();
            if (callerState !== targetState) {
                return res.status(403).json({ msg: 'Cross-territory modification forbidden.' });
            }
            // Cannot modify an admin with equal or higher rank
            const callerRank = getTierRank(req.adminUser.adminTier);
            const targetRank = getTierRank(targetAdmin.adminLevel || targetAdmin.adminRole);
            if (targetRank >= callerRank) {
                return res.status(403).json({ msg: 'Cannot modify administrator of equal or higher tier.' });
            }
        }

        const { name, phone, altPhone, status, address, password } = req.body;
        if (name) targetAdmin.name = name.trim();
        if (phone) targetAdmin.phone = String(phone).replace(/\D/g, '');
        if (altPhone !== undefined) targetAdmin.altPhone = altPhone;
        if (address !== undefined) targetAdmin.fullAddress = address;

        if (status) {
            targetAdmin.status = status === 'Active' ? 'approved' : status;
            targetAdmin.isActive = status === 'Active';
        }

        if (password && password.length >= 6) {
            const salt = await bcrypt.genSalt(10);
            targetAdmin.password = await bcrypt.hash(password, salt);
        }

        await targetAdmin.save();

        res.json({
            success: true,
            msg: 'Administrator updated successfully',
            admin: await formatAdminForResponse(targetAdmin.toObject())
        });
    } catch (err) {
        console.error('Update hierarchy admin error:', err);
        res.status(500).json({ msg: 'Server error updating administrator', error: err.message });
    }
});

// ============================================================
// 4. GET MANAGERS (HIERARCHICAL TERRITORY LIST)
// ============================================================
router.get('/managers', [auth, territoryScope], async (req, res) => {
    try {
        const { search, level, status, state, district } = req.query;
        const query = {};

        // Apply territory isolation
        if (!req.adminUser.isMainAdmin) {
            Object.assign(query, req.territoryFilter);
        } else {
            if (state && state !== 'All') query.assignedState = new RegExp(`^${state}$`, 'i');
            if (district && district !== 'All') query.assignedDistrict = new RegExp(`^${district}$`, 'i');
        }

        if (level && level !== 'All') query.level = level.toLowerCase();
        if (status && status !== 'All') query.status = status;

        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
                { managerId: { $regex: q, $options: 'i' } }
            ];
        }

        const managers = await Manager.find(query)
            .populate('parentAdminId', 'name email role adminRole')
            .populate('approvedBy', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            managers,
            total: managers.length
        });
    } catch (err) {
        console.error('Get managers error:', err);
        res.status(500).json({ msg: 'Server error retrieving managers', error: err.message });
    }
});

// ============================================================
// 5. REQUEST ONBOARDING OF MANAGER (WITH BACKEND LIMIT CHECKS)
// ============================================================
router.post('/managers/request', [auth, territoryScope], async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            altPhone,
            level,
            assignedState,
            assignedDistrict,
            assignedDivision,
            assignedPincode,
            address,
            notes
        } = req.body;

        if (!name || !name.trim()) return res.status(400).json({ msg: 'Manager Name is required' });
        if (!email || !email.trim()) return res.status(400).json({ msg: 'Email is required' });
        if (!phone || !phone.trim()) return res.status(400).json({ msg: 'Mobile number is required' });
        if (!level) return res.status(400).json({ msg: 'Manager Level is required' });

        const targetLevel = level.toLowerCase().trim();
        if (!['state', 'district', 'division', 'pincode'].includes(targetLevel)) {
            return res.status(400).json({ msg: 'Invalid Manager Level' });
        }

        // Enforce territory values based on caller tier
        let finalState = (assignedState || '').trim();
        let finalDistrict = (assignedDistrict || '').trim();
        let finalDivision = (assignedDivision || '').trim();
        let finalPincode = (assignedPincode || '').trim();

        if (!req.adminUser.isMainAdmin) {
            finalState = req.adminUser.assignedState;
            if (['district', 'division', 'pincode'].includes(req.adminUser.adminTier)) {
                finalDistrict = req.adminUser.assignedDistrict;
            }
            if (['division', 'pincode'].includes(req.adminUser.adminTier)) {
                finalDivision = req.adminUser.assignedDivision;
            }
            if (req.adminUser.adminTier === 'pincode') {
                finalPincode = req.adminUser.assignedPincode;
            }
        }

        if (targetLevel === 'state' && !finalState) {
            return res.status(400).json({ msg: 'State is required for State Manager' });
        }
        if (targetLevel === 'district' && (!finalState || !finalDistrict)) {
            return res.status(400).json({ msg: 'State and District are required for District Manager' });
        }
        if (targetLevel === 'division' && (!finalState || !finalDistrict || !finalDivision)) {
            return res.status(400).json({ msg: 'State, District, and Division are required for Division Manager' });
        }
        if (targetLevel === 'pincode' && (!finalState || !finalPincode)) {
            return res.status(400).json({ msg: 'State and Pincode are required for Pincode Manager' });
        }

        // CHECK TERRITORY MANAGER LIMITS
        const maxLimit = MANAGER_LIMITS[targetLevel] || 2;
        const countFilter = {
            level: targetLevel,
            status: 'Active',
            assignedState: new RegExp(`^${finalState}$`, 'i')
        };
        if (targetLevel === 'district') countFilter.assignedDistrict = new RegExp(`^${finalDistrict}$`, 'i');
        if (targetLevel === 'division') countFilter.assignedDivision = new RegExp(`^${finalDivision}$`, 'i');
        if (targetLevel === 'pincode') countFilter.assignedPincode = finalPincode;

        const activeManagerCount = await Manager.countDocuments(countFilter);

        // Also check pending requests in that exact territory
        const pendingRequestFilter = {
            level: targetLevel,
            status: 'Pending',
            assignedState: new RegExp(`^${finalState}$`, 'i')
        };
        if (targetLevel === 'district') pendingRequestFilter.assignedDistrict = new RegExp(`^${finalDistrict}$`, 'i');
        if (targetLevel === 'division') pendingRequestFilter.assignedDivision = new RegExp(`^${finalDivision}$`, 'i');
        if (targetLevel === 'pincode') pendingRequestFilter.assignedPincode = finalPincode;

        const pendingCount = await ManagerRequest.countDocuments(pendingRequestFilter);

        if (activeManagerCount + pendingCount >= maxLimit) {
            return res.status(400).json({
                msg: `Manager limit reached for this territory. Maximum ${maxLimit} managers permitted for ${targetLevel} level.`,
                message: `Manager limit reached for this territory.`
            });
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randDigits = Math.floor(1000 + Math.random() * 9000);
        const requestId = `MREQ-${dateStr}-${randDigits}`;

        const managerReq = new ManagerRequest({
            requestId,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: String(phone).replace(/\D/g, ''),
            altPhone: altPhone ? String(altPhone).trim() : '',
            level: targetLevel,
            assignedState: finalState,
            assignedDistrict: finalDistrict,
            assignedDivision: finalDivision,
            assignedPincode: finalPincode,
            address: address || '',
            notes: notes || '',
            requestedBy: req.adminUser._id,
            requestingAdminName: req.adminUser.name,
            requestingAdminRole: req.adminUser.adminRole || `${req.adminUser.adminTier}-admin`,
            status: 'Pending'
        });

        await managerReq.save();

        res.status(201).json({
            success: true,
            msg: 'Manager onboarding request submitted successfully to Main Admin.',
            request: managerReq
        });
    } catch (err) {
        console.error('Request manager error:', err);
        res.status(500).json({ msg: 'Server error requesting manager', error: err.message });
    }
});

// ============================================================
// 6. GET MANAGER REQUESTS
// ============================================================
router.get('/managers/requests', [auth, territoryScope], async (req, res) => {
    try {
        const { status, level, search } = req.query;
        const query = {};

        // Main Admin sees all, lower admins see requests within their territory or submitted by them
        if (!req.adminUser.isMainAdmin) {
            query.$or = [
                { requestedBy: req.adminUser._id },
                { assignedState: new RegExp(`^${req.adminUser.assignedState}$`, 'i') }
            ];
        }

        if (status && status !== 'All') query.status = status;
        if (level && level !== 'All') query.level = level.toLowerCase();

        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            query.$and = (query.$and || []).concat([{
                $or: [
                    { name: { $regex: q, $options: 'i' } },
                    { email: { $regex: q, $options: 'i' } },
                    { phone: { $regex: q, $options: 'i' } },
                    { requestId: { $regex: q, $options: 'i' } }
                ]
            }]);
        }

        const requests = await ManagerRequest.find(query)
            .populate('requestedBy', 'name email adminRole')
            .populate('reviewedBy', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            requests,
            total: requests.length
        });
    } catch (err) {
        console.error('Get manager requests error:', err);
        res.status(500).json({ msg: 'Server error retrieving manager requests', error: err.message });
    }
});

// ============================================================
// 7. APPROVE MANAGER REQUEST (MAIN ADMIN ONLY)
// ============================================================
router.put('/managers/requests/:id/approve', [auth, territoryScope], async (req, res) => {
    try {
        if (!req.adminUser.isMainAdmin) {
            return res.status(403).json({ msg: 'Unauthorized. ONLY Main Admin can approve manager onboarding requests.' });
        }

        const mReq = await ManagerRequest.findById(req.params.id);
        if (!mReq) return res.status(404).json({ msg: 'Manager request not found' });
        if (mReq.status === 'Approved') return res.status(400).json({ msg: 'Request is already approved' });

        // Double check limit before approving
        const maxLimit = MANAGER_LIMITS[mReq.level] || 2;
        const countFilter = {
            level: mReq.level,
            status: 'Active',
            assignedState: new RegExp(`^${mReq.assignedState}$`, 'i')
        };
        if (mReq.level === 'district') countFilter.assignedDistrict = new RegExp(`^${mReq.assignedDistrict}$`, 'i');
        if (mReq.level === 'division') countFilter.assignedDivision = new RegExp(`^${mReq.assignedDivision}$`, 'i');
        if (mReq.level === 'pincode') countFilter.assignedPincode = mReq.assignedPincode;

        const currentActiveCount = await Manager.countDocuments(countFilter);
        if (currentActiveCount >= maxLimit) {
            return res.status(400).json({
                msg: `Cannot approve request. Maximum limit of ${maxLimit} managers has already been reached for this territory.`
            });
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randDigits = Math.floor(1000 + Math.random() * 9000);
        const managerId = `MGR-${mReq.level.slice(0, 3).toUpperCase()}-${dateStr}-${randDigits}`;

        // Create Manager in Manager Collection
        const newManager = new Manager({
            managerId,
            name: mReq.name,
            email: mReq.email,
            phone: mReq.phone,
            altPhone: mReq.altPhone,
            level: mReq.level,
            assignedState: mReq.assignedState,
            assignedDistrict: mReq.assignedDistrict,
            assignedDivision: mReq.assignedDivision,
            assignedPincode: mReq.assignedPincode,
            address: mReq.address,
            parentAdminId: mReq.requestedBy,
            requestedBy: mReq.requestedBy,
            approvedBy: req.adminUser._id,
            status: 'Active',
            notes: mReq.notes
        });

        await newManager.save();

        mReq.status = 'Approved';
        mReq.reviewedBy = req.adminUser._id;
        mReq.reviewedAt = new Date();
        await mReq.save();

        res.json({
            success: true,
            msg: 'Manager onboarding request approved. Manager is now active in the territory.',
            manager: newManager,
            request: mReq
        });
    } catch (err) {
        console.error('Approve manager request error:', err);
        res.status(500).json({ msg: 'Server error approving request', error: err.message });
    }
});

// ============================================================
// 8. REJECT MANAGER REQUEST (MAIN ADMIN ONLY)
// ============================================================
router.put('/managers/requests/:id/reject', [auth, territoryScope], async (req, res) => {
    try {
        if (!req.adminUser.isMainAdmin) {
            return res.status(403).json({ msg: 'Unauthorized. ONLY Main Admin can reject manager onboarding requests.' });
        }

        const mReq = await ManagerRequest.findById(req.params.id);
        if (!mReq) return res.status(404).json({ msg: 'Manager request not found' });

        mReq.status = 'Rejected';
        mReq.rejectionReason = req.body.reason || 'Rejected by Main Admin';
        mReq.reviewedBy = req.adminUser._id;
        mReq.reviewedAt = new Date();
        await mReq.save();

        res.json({
            success: true,
            msg: 'Manager request rejected.',
            request: mReq
        });
    } catch (err) {
        console.error('Reject manager request error:', err);
        res.status(500).json({ msg: 'Server error rejecting request', error: err.message });
    }
});

// ============================================================
// 9. GET TERRITORY OPTIONS (FOR DYNAMIC CASCADING SELECTION)
// ============================================================
router.get('/territory/options', [auth, territoryScope], async (req, res) => {
    try {
        const { state, district, division } = req.query;

        // States
        let statesList = INDIAN_STATES;
        if (!req.adminUser.isMainAdmin && req.adminUser.assignedState) {
            statesList = [req.adminUser.assignedState];
        }

        // Districts for selected state
        let districtsList = [];
        const targetState = state || req.adminUser.assignedState;
        if (targetState) {
            const dbDistricts = await Pincode.distinct('district', { state: new RegExp(`^${targetState}$`, 'i') });
            const modelDistricts = await District.find({}).populate('stateId', 'name').lean();
            const filteredModelDistricts = modelDistricts
                .filter(d => d.stateId?.name && d.stateId.name.toLowerCase() === targetState.toLowerCase())
                .map(d => d.name);

            districtsList = Array.from(new Set([...dbDistricts, ...filteredModelDistricts])).filter(Boolean).sort();
        }

        // Divisions for selected district
        let divisionsList = [];
        const targetDistrict = district || req.adminUser.assignedDistrict;
        if (targetDistrict) {
            const dbDivisions = await Pincode.distinct('division', { district: new RegExp(`^${targetDistrict}$`, 'i') });
            const modelDivisions = await Division.find({}).populate('districtId', 'name').lean();
            const filteredModelDivisions = modelDivisions
                .filter(d => d.districtId?.name && d.districtId.name.toLowerCase() === targetDistrict.toLowerCase())
                .map(d => d.name);

            divisionsList = Array.from(new Set([...dbDivisions, ...filteredModelDivisions])).filter(Boolean).sort();
        }

        // Pincodes for selected division or district
        let pincodesList = [];
        const targetDivision = division || req.adminUser.assignedDivision;
        if (targetDivision || targetDistrict) {
            const pinFilter = {};
            if (targetState) pinFilter.state = new RegExp(`^${targetState}$`, 'i');
            if (targetDistrict) pinFilter.district = new RegExp(`^${targetDistrict}$`, 'i');
            if (targetDivision) pinFilter.division = new RegExp(`^${targetDivision}$`, 'i');

            const pins = await Pincode.find(pinFilter).select('code name postOffice').limit(100).lean();
            pincodesList = pins.map(p => ({
                code: p.code,
                name: p.name || p.postOffice || p.code,
                postOffice: p.postOffice || ''
            }));
        }

        res.json({
            success: true,
            states: statesList,
            districts: districtsList,
            divisions: divisionsList,
            pincodes: pincodesList,
            userTier: req.adminUser.adminTier,
            userTerritory: {
                state: req.adminUser.assignedState,
                district: req.adminUser.assignedDistrict,
                division: req.adminUser.assignedDivision,
                pincode: req.adminUser.assignedPincode
            }
        });
    } catch (err) {
        console.error('Get territory options error:', err);
        res.status(500).json({ msg: 'Server error retrieving territory options', error: err.message });
    }
});

module.exports = router;
