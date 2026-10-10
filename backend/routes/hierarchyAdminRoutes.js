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
const TerritoryAuditLog = require('../models/TerritoryAuditLog');
const AuditLog = require('../models/AuditLog');
const { validateTerritoryHierarchy } = require('./territory');
const TerritoryAssignmentService = require('../utils/territoryAssignmentService');

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
// Helper: Normalize Admin document for client consumption
const formatAdminForResponse = async (adminDoc, parentMap = new Map(), countsMap = {}, hierarchyParents = null) => {
    const rawLvl = adminDoc.adminLevel || adminDoc.level;
    const rawRole = (adminDoc.role || adminDoc.adminRole || '').toLowerCase();
    let level = 'pincode';
    if (rawLvl === 1 || rawLvl === '1' || rawLvl === 'state' || rawRole.includes('state')) {
        level = 'state';
    } else if (rawLvl === 2 || rawLvl === '2' || rawLvl === 'district' || rawRole.includes('district') || rawRole.includes('branch')) {
        level = 'district';
    } else if (rawLvl === 3 || rawLvl === '3' || rawLvl === 'division' || rawRole.includes('division')) {
        level = 'division';
    } else if (rawLvl === 4 || rawLvl === '4' || rawLvl === 'pincode' || rawRole.includes('pincode')) {
        level = 'pincode';
    } else if (rawRole.includes('super') || rawRole.includes('main')) {
        level = 'main';
    }
    
    // Resolve Parent Admin Name & Role
    let parentInfo = null;
    if (adminDoc.parentAdminId) {
        const pKey = String(adminDoc.parentAdminId._id || adminDoc.parentAdminId);
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
    if (!parentInfo && parentMap.has(String(adminDoc._id))) {
        const p = parentMap.get(String(adminDoc._id));
        parentInfo = {
            id: p._id,
            name: p.name,
            email: p.email,
            role: p.adminRole || p.role
        };
    }
    if (!parentInfo && hierarchyParents) {
        const st = (adminDoc.assignedState || adminDoc.state || '').trim().toLowerCase();
        const dist = (adminDoc.assignedDistrict || adminDoc.district || '').trim().toLowerCase();
        const div = (adminDoc.assignedDivision || adminDoc.division || '').trim().toLowerCase();

        if (level === 'pincode') {
            const p = hierarchyParents.divAdminsByDiv?.get(`${st}::${dist}::${div}`) ||
                      hierarchyParents.distAdminsByDist?.get(`${st}::${dist}`) ||
                      hierarchyParents.stateAdminsByState?.get(st);
            if (p && String(p._id) !== String(adminDoc._id)) {
                parentInfo = { id: p._id, name: p.name, email: p.email, role: p.adminRole || p.role || 'Division Admin' };
            }
        } else if (level === 'division') {
            const p = hierarchyParents.distAdminsByDist?.get(`${st}::${dist}`) ||
                      hierarchyParents.stateAdminsByState?.get(st);
            if (p && String(p._id) !== String(adminDoc._id)) {
                parentInfo = { id: p._id, name: p.name, email: p.email, role: p.adminRole || p.role || 'District Admin' };
            }
        } else if (level === 'district') {
            const p = hierarchyParents.stateAdminsByState?.get(st);
            if (p && String(p._id) !== String(adminDoc._id)) {
                parentInfo = { id: p._id, name: p.name, email: p.email, role: p.adminRole || p.role || 'State Admin' };
            }
        } else if (level === 'state') {
            parentInfo = { id: 'main', name: 'Main Admin', email: 'admin@example.com', role: 'Super Admin' };
        }
    }
    if (!parentInfo && level === 'state') {
        parentInfo = { id: 'main', name: 'Main Admin', email: 'admin@example.com', role: 'Super Admin' };
    }

    const adminIdStr = String(adminDoc._id);
    const childAdminCount = countsMap.adminChildren?.[adminIdStr] || 0;
    const managerCount = countsMap.managersUnder?.[adminIdStr] || 0;

    const assignedState = adminDoc.assignedState || adminDoc.state || '—';
    const assignedDistrict = adminDoc.assignedDistrict || adminDoc.district || '—';
    const assignedDivision = adminDoc.assignedDivision || adminDoc.division || '—';
    const assignedPincode = adminDoc.assignedPincode ? String(adminDoc.assignedPincode) : (adminDoc.pincode ? String(adminDoc.pincode) : '—');

    const addressLine1 = adminDoc.addressLine1 || adminDoc.kycDocs?.addressLine1 || adminDoc.address || '';
    const addressLine2 = adminDoc.addressLine2 || adminDoc.kycDocs?.addressLine2 || '';
    const locality = adminDoc.locality || adminDoc.taluk || adminDoc.kycDocs?.locality || adminDoc.kycDocs?.taluk || adminDoc.division || '';
    const city = adminDoc.city || adminDoc.kycDocs?.city || adminDoc.division || '';
    const fullAddress = adminDoc.fullAddress || [addressLine1, locality, city, assignedDistrict !== '—' ? assignedDistrict : '', assignedState !== '—' ? assignedState : '', assignedPincode !== '—' ? assignedPincode : ''].filter(Boolean).join(', ') || adminDoc.address || '';

    const createdByName = parentInfo?.name 
        ? `${parentInfo.name} (${parentInfo.role || 'Admin'})` 
        : (level === 'state' ? 'Main Admin' : (level === 'district' ? 'State Admin' : (level === 'division' ? 'District Admin' : 'Division Admin')));

    return {
        _id: adminDoc._id,
        id: adminDoc._id,
        name: adminDoc.name,
        email: adminDoc.email,
        phone: adminDoc.phone || adminDoc.mobile || '—',
        mobile: adminDoc.mobile || adminDoc.phone || '—',
        altPhone: adminDoc.altPhone || adminDoc.alternatePhone || adminDoc.alternateMobile || adminDoc.altMobile || '',
        role: adminDoc.role || 'admin',
        adminRole: adminDoc.adminRole || `${level}-admin`,
        adminLevel: level,
        level: level,
        status: (adminDoc.status || 'Active').toLowerCase() === 'active' || adminDoc.status === 'approved' || adminDoc.isActive ? 'Active' : (adminDoc.status || 'Inactive'),
        isActive: adminDoc.isActive !== false,
        assignedState,
        assignedDistrict,
        assignedDivision,
        assignedPincode,
        state: adminDoc.state || assignedState,
        district: adminDoc.district || assignedDistrict,
        division: adminDoc.division || assignedDivision,
        pincode: adminDoc.pincode ? String(adminDoc.pincode) : assignedPincode,
        stateId: adminDoc.stateId || '',
        districtId: adminDoc.districtId || '',
        divisionId: adminDoc.divisionId || '',
        pincodeId: adminDoc.pincodeId || '',
        postOffice: adminDoc.postOffice || '—',
        address: addressLine1 || fullAddress,
        fullAddress,
        addressLine1,
        addressLine2,
        locality,
        taluk: adminDoc.taluk || locality,
        city,
        dob: adminDoc.dob || adminDoc.dateOfBirth || null,
        dateOfBirth: adminDoc.dateOfBirth || adminDoc.dob || null,
        gender: adminDoc.gender || adminDoc.kycDocs?.gender || adminDoc.kyc?.gender || null,
        fatherName: adminDoc.fatherName || adminDoc.kycDocs?.fatherName || adminDoc.spouseName || adminDoc.guardianName || '',
        bloodGroup: adminDoc.bloodGroup || adminDoc.kycDocs?.bloodGroup || adminDoc.kyc?.bloodGroup || '',
        nationality: adminDoc.nationality || adminDoc.kycDocs?.nationality || 'Indian',
        bankName: adminDoc.bankName || adminDoc.bankDetails?.bankName || '',
        accountNumber: adminDoc.accountNumber || adminDoc.bankDetails?.accountNumber || '',
        accountHolderName: adminDoc.accountHolderName || adminDoc.bankDetails?.accountHolderName || adminDoc.name || '',
        ifscCode: adminDoc.ifscCode || adminDoc.bankDetails?.ifscCode || '',
        branchName: adminDoc.branchName || adminDoc.bankDetails?.branchName || '',
        aadharNumber: adminDoc.aadharNumber || adminDoc.aadhaarNumber || adminDoc.kyc?.aadhaarNumber || adminDoc.kyc?.aadharNumber || '',
        aadhaarNumber: adminDoc.aadhaarNumber || adminDoc.aadharNumber || adminDoc.kyc?.aadhaarNumber || adminDoc.kyc?.aadharNumber || '',
        panNumber: adminDoc.panNumber || adminDoc.kyc?.panNumber || '',
        kyc: adminDoc.kyc || {},
        kycDocs: adminDoc.kycDocs || {},
        registrationId: adminDoc.registrationId || (typeof adminDoc._id === 'string' && adminDoc._id.startsWith('ADM-') ? adminDoc._id : `ADM-${String(adminDoc._id).slice(-6).toUpperCase()}`),
        parentAdmin: parentInfo,
        parentAdminId: adminDoc.parentAdminId || parentInfo?.id,
        createdByName,
        childAdminCount,
        managerCount,
        lastLogin: adminDoc.lastLogin || null,
        createdAt: adminDoc.createdAt || adminDoc.updatedAt || new Date()
    };
};

// ============================================================
// 1. GET HIERARCHICAL ADMINS (SCOPED BY CALLER TERRITORY)
// ============================================================
const getHierarchyAdminsHandler = async (req, res) => {
    try {
        const { search, role, status } = req.query;
        const territoryFilter = req.territoryFilter || {};

        const adminRoles = [
            'admin', 'super-admin', 'superadmin', 'main-admin',
            'State Admin', 'District Admin', 'Division Admin', 'Pincode Admin',
            'state-admin', 'district-admin', 'division-admin', 'pincode-admin',
            'branch-admin', 'state_admin', 'district_admin', 'division_admin', 'pincode_admin'
        ];

        // Base query: fetch users with admin privileges (supporting all level & role variants)
        const query = {
            $or: [
                { role: { $in: adminRoles } },
                { adminRole: { $in: adminRoles } },
                { adminLevel: { $in: ['main', 'state', 'district', 'division', 'pincode'] } },
                { level: { $in: ['state', 'district', 'division', 'pincode', 1, 2, 3, 4, '1', '2', '3', '4'] } }
            ],
            // Exclude purely non-admin accounts
            role: { $nin: ['Vendor', 'vendor', 'Member', 'member', 'customer', 'Customer', 'agent', 'state_manager', 'district_manager', 'division_manager', 'pincode_manager'] }
        };

        // Apply territory isolation filter if not super admin
        if (!req.adminUser.isMainAdmin) {
            Object.assign(query, territoryFilter);
            query.adminRole = { $ne: 'super-admin' };
            query.role = { $ne: 'super-admin' };
            query.email = { $ne: 'admin@example.com' };
        }

        if (status && status !== 'All') {
            if (status === 'Active') {
                query.$and = (query.$and || []).concat([{
                    $or: [{ status: 'Active' }, { status: 'active' }, { status: 'approved' }, { isActive: true }]
                }]);
            } else {
                query.status = status;
            }
        }

        if (role && role !== 'All') {
            const roleRegex = new RegExp(`^${role}$`, 'i');
            query.$and = (query.$and || []).concat([{
                $or: [{ adminRole: roleRegex }, { role: roleRegex }, { adminLevel: roleRegex }, { level: roleRegex }]
            }]);
        }

        let adminDocs = await User.find(query)
            .select('name email phone mobile altPhone alternatePhone alternateMobile altMobile role adminRole adminLevel level assignedState state stateId assignedDistrict district districtId assignedDivision division divisionId assignedPincode pincode pincodeId postOffice fullAddress address city dob dateOfBirth gender fatherName bloodGroup nationality bankName accountNumber accountHolderName ifscCode branchName addressLine1 addressLine2 locality taluk aadharNumber aadhaarNumber panNumber kyc kycDocs status isActive parentAdminId createdBy onboardedBy assignedBy registrationId id lastLogin createdAt updatedAt')
            .sort({ createdAt: -1 })
            .lean();

        // Search in-memory for name, email, phone, territory
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            adminDocs = adminDocs.filter(a =>
                (a.name && a.name.toLowerCase().includes(q)) ||
                (a.email && a.email.toLowerCase().includes(q)) ||
                (a.phone && a.phone.includes(q)) ||
                (a.mobile && a.mobile.includes(q)) ||
                (a.assignedState && a.assignedState.toLowerCase().includes(q)) ||
                (a.state && a.state.toLowerCase().includes(q)) ||
                (a.assignedDistrict && a.assignedDistrict.toLowerCase().includes(q)) ||
                (a.district && a.district.toLowerCase().includes(q)) ||
                (a.assignedDivision && a.assignedDivision.toLowerCase().includes(q)) ||
                (a.division && a.division.toLowerCase().includes(q)) ||
                (String(a.assignedPincode || a.pincode || '').includes(q))
            );
        }

        // Filter out Super Admin admin@example.com and records without a valid assigned/state
        adminDocs = adminDocs.filter(a => {
            if (a.email === 'admin@example.com') return false;
            const roleLow = String(a.role || '').toLowerCase();
            if (roleLow === 'super-admin' && (!a.assignedState && !a.state)) return false;
            const st = (a.assignedState || a.state || '').trim();
            if (!st || st.toLowerCase() === 'general state' || st.toLowerCase() === 'state') return false;
            return true;
        });

        // Preload parents to avoid N+1 lookups
        const parentIds = adminDocs.map(a => a.parentAdminId).filter(Boolean);
        const parents = parentIds.length > 0 ? await User.find({ _id: { $in: parentIds } }).select('name email adminRole role').lean() : [];
        const parentMap = new Map();
        parents.forEach(p => parentMap.set(String(p._id), p));

        // Index admins by territory level so parent hierarchy can be resolved accurately without N+1 queries
        const stateAdminsByState = new Map();
        const distAdminsByDist = new Map();
        const divAdminsByDiv = new Map();

        adminDocs.forEach(a => {
            const rawLvl = a.adminLevel || a.level;
            const rawRole = (a.role || a.adminRole || '').toLowerCase();
            const st = (a.assignedState || a.state || '').trim().toLowerCase();
            const dist = (a.assignedDistrict || a.district || '').trim().toLowerCase();
            const div = (a.assignedDivision || a.division || '').trim().toLowerCase();

            if (rawLvl === 1 || rawLvl === '1' || rawLvl === 'state' || rawRole.includes('state')) {
                if (st) stateAdminsByState.set(st, a);
            } else if (rawLvl === 2 || rawLvl === '2' || rawLvl === 'district' || rawRole.includes('district') || rawRole.includes('branch')) {
                if (st && dist) distAdminsByDist.set(`${st}::${dist}`, a);
            } else if (rawLvl === 3 || rawLvl === '3' || rawLvl === 'division' || rawRole.includes('division')) {
                if (st && dist && div) divAdminsByDiv.set(`${st}::${dist}::${div}`, a);
            }
        });

        const hierarchyParents = { stateAdminsByState, distAdminsByDist, divAdminsByDiv };

        // Preload managers for count calculations
        const managerFilter = !req.adminUser.isMainAdmin ? territoryFilter : {};
        const managers = await Manager.find(managerFilter).select('level assignedState state assignedDistrict district assignedDivision division assignedPincode pincode parentAdminId status').lean();

        // Calculate counts map
        const countsMap = {
            adminChildren: {},
            managersUnder: {}
        };

        // Group child admins by parentAdminId and by territory hierarchy
        adminDocs.forEach(a => {
            if (a.parentAdminId) {
                const pId = String(a.parentAdminId);
                countsMap.adminChildren[pId] = (countsMap.adminChildren[pId] || 0) + 1;
            }

            const aRawLvl = a.adminLevel || a.level;
            const aRawRole = (a.role || a.adminRole || '').toLowerCase();
            let aLvl = 'pincode';
            if (aRawLvl === 1 || aRawLvl === '1' || aRawLvl === 'state' || aRawRole.includes('state')) aLvl = 'state';
            else if (aRawLvl === 2 || aRawLvl === '2' || aRawLvl === 'district' || aRawRole.includes('district') || aRawRole.includes('branch')) aLvl = 'district';
            else if (aRawLvl === 3 || aRawLvl === '3' || aRawLvl === 'division' || aRawRole.includes('division')) aLvl = 'division';
            else if (aRawLvl === 4 || aRawLvl === '4' || aRawLvl === 'pincode' || aRawRole.includes('pincode')) aLvl = 'pincode';

            const aState = (a.assignedState || a.state || '').toLowerCase();
            const aDist = (a.assignedDistrict || a.district || '').toLowerCase();
            const aDiv = (a.assignedDivision || a.division || '').toLowerCase();

            // Link children to their parent admins in hierarchy tree when direct parentAdminId isn't stored
            if (!a.parentAdminId) {
                adminDocs.forEach(parent => {
                    const pRawLvl = parent.adminLevel || parent.level;
                    const pRawRole = (parent.role || parent.adminRole || '').toLowerCase();
                    let pLvl = 'main';
                    if (pRawLvl === 1 || pRawLvl === '1' || pRawLvl === 'state' || pRawRole.includes('state')) pLvl = 'state';
                    else if (pRawLvl === 2 || pRawLvl === '2' || pRawLvl === 'district' || pRawRole.includes('district') || pRawRole.includes('branch')) pLvl = 'district';
                    else if (pRawLvl === 3 || pRawLvl === '3' || pRawLvl === 'division' || pRawRole.includes('division')) pLvl = 'division';

                    const pState = (parent.assignedState || parent.state || '').toLowerCase();
                    const pDist = (parent.assignedDistrict || parent.district || '').toLowerCase();
                    const pDiv = (parent.assignedDivision || parent.division || '').toLowerCase();

                    if (pLvl === 'state' && aLvl === 'district') {
                        if ((parent.stateId && a.stateId && String(parent.stateId) === String(a.stateId)) || (pState && aState && pState === aState)) {
                            countsMap.adminChildren[String(parent._id)] = (countsMap.adminChildren[String(parent._id)] || 0) + 1;
                        }
                    } else if (pLvl === 'district' && aLvl === 'division') {
                        if ((parent.districtId && a.districtId && String(parent.districtId) === String(a.districtId)) || (pDist && aDist && pDist === aDist)) {
                            countsMap.adminChildren[String(parent._id)] = (countsMap.adminChildren[String(parent._id)] || 0) + 1;
                        }
                    } else if (pLvl === 'division' && aLvl === 'pincode') {
                        if ((parent.divisionId && a.divisionId && String(parent.divisionId) === String(a.divisionId)) || (pDiv && aDiv && pDiv === aDiv)) {
                            countsMap.adminChildren[String(parent._id)] = (countsMap.adminChildren[String(parent._id)] || 0) + 1;
                        }
                    }
                });
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
                const aRawLvl = a.adminLevel || a.level;
                const aRawRole = (a.role || a.adminRole || '').toLowerCase();
                let aLevel = 'pincode';
                if (aRawLvl === 1 || aRawLvl === '1' || aRawLvl === 'state' || aRawRole.includes('state')) aLevel = 'state';
                else if (aRawLvl === 2 || aRawLvl === '2' || aRawLvl === 'district' || aRawRole.includes('district') || aRawRole.includes('branch')) aLevel = 'district';
                else if (aRawLvl === 3 || aRawLvl === '3' || aRawLvl === 'division' || aRawRole.includes('division')) aLevel = 'division';

                const aState = (a.assignedState || a.state || '').toLowerCase();
                const aDist = (a.assignedDistrict || a.district || '').toLowerCase();
                const aDiv = (a.assignedDivision || a.division || '').toLowerCase();
                const aPin = String(a.assignedPincode || a.pincode || '');

                const mState = (m.assignedState || m.state || '').toLowerCase();
                const mDist = (m.assignedDistrict || m.district || '').toLowerCase();
                const mDiv = (m.assignedDivision || m.division || '').toLowerCase();
                const mPin = String(m.assignedPincode || m.pincode || '');

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
            adminDocs.map(a => formatAdminForResponse(a, parentMap, countsMap, hierarchyParents))
        );

        // Fetch strict assigned hierarchy tree (only locations with real assigned admins)
        const assignedHierarchy = await TerritoryAssignmentService.getAssignedHierarchyTree('admins', req.territoryFilter || {});

        res.json({
            success: true,
            admins: formattedAdmins,
            hierarchy: assignedHierarchy,
            currentUserTier: req.adminUser.adminTier,
            isMainAdmin: req.adminUser.isMainAdmin,
            total: formattedAdmins.length
        });
    } catch (err) {
        console.error('Fetch hierarchy admins error:', err);
        res.status(500).json({ msg: 'Server error retrieving administrators', error: err.message });
    }
};

router.get('/hierarchy-admins', [auth, territoryScope], getHierarchyAdminsHandler);
router.get('/admins', [auth, territoryScope], getHierarchyAdminsHandler);

router.get('/admins/assigned-hierarchy', [auth, territoryScope], async (req, res) => {
    try {
        const tree = await TerritoryAssignmentService.getAssignedHierarchyTree('admins', req.territoryFilter || {});
        res.json({ success: true, hierarchy: tree });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/hierarchy-admins/assigned-hierarchy', [auth, territoryScope], async (req, res) => {
    try {
        const tree = await TerritoryAssignmentService.getAssignedHierarchyTree('admins', req.territoryFilter || {});
        res.json({ success: true, hierarchy: tree });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================
// 1C. GET STATE ADMINISTRATOR CAPACITY (MAX 4 PER STATE)
// ============================================================
const getStateCapacityHandler = async (req, res) => {
    try {
        const stateName = (req.query.state || req.params.stateName || req.params.state || '').trim();
        if (!stateName) {
            return res.status(400).json({ success: false, msg: 'State parameter is required' });
        }

        const stateRegex = new RegExp(`^${stateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

        // Query genuine State Administrator accounts registered for this state
        const qualifyingAdmins = await User.find({
            role: 'admin',
            $or: [
                { adminLevel: 'state' },
                { level: 'state' },
                { adminRole: 'state-admin' }
            ],
            email: { $ne: 'admin@example.com' },
            $or: [
                { assignedState: stateRegex },
                { state: stateRegex }
            ],
            status: { $nin: ['deleted', 'rejected', 'revoked'] },
            isDeleted: { $ne: true }
        }).select('_id name email phone status adminRole adminLevel assignedState registrationId createdAt').lean();

        const limit = 4;
        const used = qualifyingAdmins.length;
        const remaining = Math.max(0, limit - used);
        const isFull = used >= limit;

        return res.json({
            success: true,
            state: stateName,
            limit,
            used,
            remaining,
            isFull,
            message: isFull
                ? 'This state has reached its maximum capacity of 4 State Administrators.'
                : `State Administrators: ${used} of 4 slots used. ${remaining} slot${remaining === 1 ? '' : 's'} remaining.`,
            admins: qualifyingAdmins
        });
    } catch (err) {
        console.error('Error fetching state capacity:', err);
        return res.status(500).json({ success: false, msg: 'Server error retrieving state capacity', error: err.message });
    }
};

router.get('/admins/state-capacity', [auth, territoryScope], getStateCapacityHandler);
router.get('/admins/state-capacity/:stateName', [auth, territoryScope], getStateCapacityHandler);
router.get('/territory/state-capacity', [auth, territoryScope], getStateCapacityHandler);
router.get('/territory/state-capacity/:stateName', [auth, territoryScope], getStateCapacityHandler);

// ============================================================
// 1B. GET ONBOARDING REQUESTS & ACTIVITY AUDIT TRAIL
// ============================================================
const getAdminRequestsHandler = async (req, res) => {
    try {
        const territoryFilter = req.territoryFilter || {};
        
        // 1. Fetch ManagerRequests (requests submitted for state, district, division, pincode admins/managers)
        const managerReqQuery = {};
        if (territoryFilter.assignedState) {
            managerReqQuery.assignedState = territoryFilter.assignedState;
        }
        if (territoryFilter.assignedDistrict) {
            managerReqQuery.assignedDistrict = territoryFilter.assignedDistrict;
        }
        if (territoryFilter.assignedDivision) {
            managerReqQuery.assignedDivision = territoryFilter.assignedDivision;
        }

        const managerRequests = await ManagerRequest.find(managerReqQuery)
            .sort({ createdAt: -1 })
            .lean()
            .catch(() => []);

        // 2. Fetch User collection pending admin onboarding
        const userAdminQuery = {
            role: { $in: ['admin', 'super-admin'] },
            status: { $in: ['pending', 'pending_approval', 'requested', 'in_review', 'under_verification'] }
        };
        if (territoryFilter.assignedState) {
            userAdminQuery.$or = [
                { assignedState: territoryFilter.assignedState },
                { state: territoryFilter.assignedState }
            ];
        }
        const pendingUsers = await User.find(userAdminQuery)
            .select('-password -passwordHash')
            .sort({ createdAt: -1 })
            .lean()
            .catch(() => []);

        // Format unified list of onboarding requests
        const formatted = [];

        for (const r of (managerRequests || [])) {
            const rawLvl = r.level ?? 'Admin';
            const lvlUpper = (rawLvl === 1 || rawLvl === '1') ? 'STATE'
                : (rawLvl === 2 || rawLvl === '2') ? 'DISTRICT'
                : (rawLvl === 3 || rawLvl === '3') ? 'DIVISION'
                : (rawLvl === 4 || rawLvl === '4') ? 'PINCODE'
                : String(rawLvl).toUpperCase();
            const lvlRoleStr = (rawLvl === 1 || rawLvl === '1') ? 'State'
                : (rawLvl === 2 || rawLvl === '2') ? 'District'
                : (rawLvl === 3 || rawLvl === '3') ? 'Division'
                : (rawLvl === 4 || rawLvl === '4') ? 'Pincode'
                : (typeof rawLvl === 'string' && rawLvl.trim()) ? (rawLvl.charAt(0).toUpperCase() + rawLvl.slice(1))
                : 'Territory';
            formatted.push({
                _id: String(r._id || r.requestId),
                requestType: `${lvlUpper} Onboarding`,
                requestedBy: {
                    name: r.requestedBy?.name || 'Territory Admin',
                    role: r.requestedBy?.role || 'Admin'
                },
                name: r.name || 'Candidate',
                phone: r.phone || '',
                email: r.email || '',
                requestedRole: `${lvlRoleStr} Admin`,
                role: `${lvlRoleStr} Admin`,
                state: r.assignedState || '',
                district: r.assignedDistrict || '',
                division: r.assignedDivision || '',
                pincode: r.assignedPincode || '',
                status: String(r.status || 'Pending').charAt(0).toUpperCase() + String(r.status || 'Pending').slice(1).toLowerCase(),
                createdAt: r.createdAt || new Date()
            });
        }

        for (const u of (pendingUsers || [])) {
            formatted.push({
                _id: String(u._id),
                requestType: `${(u.adminLevel || u.level || 'Admin').toUpperCase()} Onboarding`,
                requestedBy: {
                    name: u.referredBy?.name || 'Administrator',
                    role: u.referredBy?.role || 'Admin'
                },
                name: u.name || 'Candidate',
                phone: u.phone || '',
                email: u.email || '',
                requestedRole: u.adminRole || `${(u.adminLevel || 'territory')} Admin`,
                role: u.adminRole || 'Admin',
                state: u.assignedState || u.state || '',
                district: u.assignedDistrict || u.district || '',
                division: u.assignedDivision || u.division || '',
                pincode: u.assignedPincode ? String(u.assignedPincode) : (u.pincode || ''),
                status: (u.status || 'Pending').charAt(0).toUpperCase() + (u.status || 'Pending').slice(1).toLowerCase(),
                createdAt: u.createdAt || new Date()
            });
        }

        res.json(formatted);
    } catch (err) {
        console.error('Get admin requests error:', err);
        res.status(500).json({ success: false, msg: 'Server error retrieving onboarding requests', requests: [], error: err.message });
    }
};

const getAdminActivityHandler = async (req, res) => {
    try {
        const territoryFilter = req.territoryFilter || {};
        const query = {};
        if (territoryFilter.assignedState) {
            query.$or = [
                { territoryName: territoryFilter.assignedState },
                { 'metadata.state': territoryFilter.assignedState }
            ];
        }

        const [tLogs, aLogs] = await Promise.all([
            TerritoryAuditLog.find(query).sort({ timestamp: -1 }).limit(100).lean().catch(() => []),
            AuditLog.find({}).sort({ createdAt: -1 }).limit(50).lean().catch(() => [])
        ]);

        const formatted = [];

        for (const log of (tLogs || [])) {
            formatted.push({
                timestamp: log.timestamp || log.createdAt || new Date(),
                actorName: log.actorName || 'Admin',
                action: log.action || 'Territory Configuration',
                role: log.actorRole || 'Administrator',
                territory: log.territoryName ? `${log.territoryType || 'Territory'}: ${log.territoryName}` : 'Central',
                status: 'Success'
            });
        }

        for (const log of (aLogs || [])) {
            formatted.push({
                timestamp: log.createdAt || log.timestamp || new Date(),
                actorName: log.userEmail || 'System Admin',
                action: log.action ? log.action.replace(/_/g, ' ').toUpperCase() : 'Audit Event',
                role: log.userRole || 'Admin',
                territory: log.location?.city ? `${log.location.city}, ${log.location.country || 'India'}` : 'Global',
                status: log.status === 'success' ? 'Success' : (log.status || 'Info')
            });
        }

        formatted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(formatted);
    } catch (err) {
        console.error('Get admin activity logs error:', err);
        res.status(500).json({ success: false, msg: 'Server error retrieving activity logs', logs: [], error: err.message });
    }
};

const approveAdminRequestHandler = async (req, res) => {
    try {
        const reqId = req.params.id;
        const query = mongoose.Types.ObjectId.isValid(reqId) ? { _id: new mongoose.Types.ObjectId(reqId) } : { _id: reqId };

        let updated = await ManagerRequest.findOneAndUpdate(
            { $or: [query, { requestId: reqId }] },
            { $set: { status: 'approved', approvedAt: new Date(), approvedBy: req.adminUser?.email || 'Admin' } },
            { new: true }
        );

        if (!updated) {
            updated = await User.findOneAndUpdate(
                query,
                { $set: { status: 'approved', isActive: true, approvedAt: new Date() } },
                { new: true }
            );
        }

        res.json({ success: true, msg: 'Onboarding request approved successfully', data: updated });
    } catch (err) {
        console.error('Approve admin request error:', err);
        res.status(500).json({ success: false, msg: 'Server error approving request', error: err.message });
    }
};

const rejectAdminRequestHandler = async (req, res) => {
    try {
        const reqId = req.params.id;
        const { reason } = req.body || {};
        const query = mongoose.Types.ObjectId.isValid(reqId) ? { _id: new mongoose.Types.ObjectId(reqId) } : { _id: reqId };

        let updated = await ManagerRequest.findOneAndUpdate(
            { $or: [query, { requestId: reqId }] },
            { $set: { status: 'rejected', rejectionReason: reason || 'Application rejected by Admin', rejectedAt: new Date() } },
            { new: true }
        );

        if (!updated) {
            updated = await User.findOneAndUpdate(
                query,
                { $set: { status: 'rejected', rejectionReason: reason || 'Application rejected by Admin', isActive: false } },
                { new: true }
            );
        }

        res.json({ success: true, msg: 'Onboarding request rejected', data: updated });
    } catch (err) {
        console.error('Reject admin request error:', err);
        res.status(500).json({ success: false, msg: 'Server error rejecting request', error: err.message });
    }
};

// ============================================================
// 1C. GET SINGLE ADMINISTRATOR DETAILS (ALL NON-SENSITIVE FIELDS)
// ============================================================
const getSingleAdminHandler = async (req, res, next) => {
    try {
        let adminId = req.params.id;
        // Never treat sub-path keywords as administrator IDs
        if (['requests', 'activity', 'stats', 'export', 'dashboard', 'pin-status'].includes(adminId)) {
            return typeof next === 'function' ? next() : res.status(404).json({ success: false, msg: 'Endpoint not found' });
        }

        const query = mongoose.Types.ObjectId.isValid(adminId) 
            ? { $or: [{ _id: new mongoose.Types.ObjectId(adminId) }, { _id: adminId }, { id: adminId }, { registrationId: adminId }] }
            : { $or: [{ _id: adminId }, { id: adminId }, { registrationId: adminId }] };

        const adminDoc = await User.findOne(query)
            .select('-password -passwordHash')
            .populate('parentAdminId', 'name email role adminRole')
            .populate('branchId', 'name')
            .lean();

        if (!adminDoc) {
            return res.status(404).json({ success: false, msg: 'Administrator not found' });
        }

        // Territory isolation check for lower admins
        if (!req.adminUser.isMainAdmin) {
            const adminState = adminDoc.assignedState || adminDoc.state;
            if (req.adminUser.assignedState && adminState && 
                adminState.toLowerCase() !== req.adminUser.assignedState.toLowerCase()) {
                return res.status(403).json({ success: false, msg: 'Access denied to administrator outside your territory' });
            }
        }

        const parentMap = new Map();
        if (adminDoc.parentAdminId) {
            parentMap.set(String(adminDoc.parentAdminId._id || adminDoc.parentAdminId), adminDoc.parentAdminId);
        } else {
            // Hierarchically resolve parent
            const rawLvl = adminDoc.adminLevel || adminDoc.level;
            const rawRole = (adminDoc.role || adminDoc.adminRole || '').toLowerCase();
            let lvl = 'pincode';
            if (rawLvl === 1 || rawLvl === '1' || rawLvl === 'state' || rawRole.includes('state')) lvl = 'state';
            else if (rawLvl === 2 || rawLvl === '2' || rawLvl === 'district' || rawRole.includes('district') || rawRole.includes('branch')) lvl = 'district';
            else if (rawLvl === 3 || rawLvl === '3' || rawLvl === 'division' || rawRole.includes('division')) lvl = 'division';

            const st = adminDoc.assignedState || adminDoc.state;
            const dist = adminDoc.assignedDistrict || adminDoc.district;
            const div = adminDoc.assignedDivision || adminDoc.division;

            try {
                if (lvl === 'pincode') {
                    const parent = await User.findOne({
                        $or: [
                            { role: { $in: ['Division Admin', 'division-admin', 'division_admin', 3, '3'] }, division: div, district: dist },
                            { role: { $in: ['District Admin', 'district-admin', 'district_admin', 2, '2'] }, district: dist },
                            { role: { $in: ['State Admin', 'state-admin', 'state_admin', 1, '1'] }, state: st }
                        ]
                    }).select('name email role adminRole').lean();
                    if (parent) parentMap.set(String(adminDoc._id), parent);
                } else if (lvl === 'division') {
                    const parent = await User.findOne({
                        $or: [
                            { role: { $in: ['District Admin', 'district-admin', 'district_admin', 2, '2'] }, district: dist },
                            { role: { $in: ['State Admin', 'state-admin', 'state_admin', 1, '1'] }, state: st }
                        ]
                    }).select('name email role adminRole').lean();
                    if (parent) parentMap.set(String(adminDoc._id), parent);
                } else if (lvl === 'district') {
                    const parent = await User.findOne({
                        $or: [
                            { role: { $in: ['State Admin', 'state-admin', 'state_admin', 1, '1'] }, state: st },
                            { assignedState: st }
                        ]
                    }).select('name email role adminRole').lean();
                    if (parent) parentMap.set(String(adminDoc._id), parent);
                }
            } catch (pErr) {
                console.warn('Could not resolve hierarchical parent:', pErr.message);
            }
        }

        const formatted = await formatAdminForResponse(adminDoc, parentMap, {});
        const completeRecord = {
            ...adminDoc,
            ...formatted,
            password: undefined,
            passwordHash: undefined
        };
        delete completeRecord.password;
        delete completeRecord.passwordHash;

        res.json({ success: true, admin: completeRecord });
    } catch (err) {
        console.error('Get single admin error:', err);
        res.status(500).json({ success: false, msg: 'Server error retrieving administrator details', error: err.message });
    }
};

// Explicit Routes for Onboarding Requests & Activity Log (MUST BE DECLARED BEFORE /:id ROUTES)
router.get('/admins/requests', [auth, territoryScope], getAdminRequestsHandler);
router.get('/hierarchy-admins/requests', [auth, territoryScope], getAdminRequestsHandler);
router.get('/admins/activity', [auth, territoryScope], getAdminActivityHandler);
router.get('/hierarchy-admins/activity', [auth, territoryScope], getAdminActivityHandler);
router.post('/admins/requests/:id/approve', [auth, territoryScope], approveAdminRequestHandler);
router.put('/admins/requests/:id/approve', [auth, territoryScope], approveAdminRequestHandler);
router.post('/admins/requests/:id/reject', [auth, territoryScope], rejectAdminRequestHandler);
router.put('/admins/requests/:id/reject', [auth, territoryScope], rejectAdminRequestHandler);

// ============================================================
// 1D. HIERARCHICAL CHILD ADMIN RESOLVER
// Resolves actual child admins based on direct parentAdminId OR 
// database territory hierarchy (State -> District -> Division -> Pincode)
// ============================================================
const getChildAdminsForParent = async (parentId) => {
    let parent = null;
    if (mongoose.Types.ObjectId.isValid(parentId)) {
        parent = await User.findById(parentId).lean();
    }
    if (!parent) {
        parent = await User.findOne({ $or: [{ _id: parentId }, { id: parentId }, { email: parentId }, { registrationId: parentId }] }).lean();
    }
    if (!parent) return [];

    const pRawLvl = parent.adminLevel || parent.level;
    const pRawRole = (parent.role || parent.adminRole || '').toLowerCase();
    let pLevel = 'main';
    if (pRawLvl === 1 || pRawLvl === '1' || pRawLvl === 'state' || pRawRole.includes('state')) pLevel = 'state';
    else if (pRawLvl === 2 || pRawLvl === '2' || pRawLvl === 'district' || pRawRole.includes('district') || pRawRole.includes('branch')) pLevel = 'district';
    else if (pRawLvl === 3 || pRawLvl === '3' || pRawLvl === 'division' || pRawRole.includes('division')) pLevel = 'division';
    else if (pRawLvl === 4 || pRawLvl === '4' || pRawLvl === 'pincode' || pRawRole.includes('pincode')) pLevel = 'pincode';

    const pState = (parent.assignedState || parent.state || '').trim().toLowerCase();
    const pDist = (parent.assignedDistrict || parent.district || '').trim().toLowerCase();
    const pDiv = (parent.assignedDivision || parent.division || '').trim().toLowerCase();

    let targetLevel = null;
    let targetLevelValues = [];
    if (pLevel === 'state') {
        targetLevel = 'district';
        targetLevelValues = [2, '2', 'district', 'District Admin', 'district-admin', 'district_admin'];
    } else if (pLevel === 'district') {
        targetLevel = 'division';
        targetLevelValues = [3, '3', 'division', 'Division Admin', 'division-admin', 'division_admin'];
    } else if (pLevel === 'division') {
        targetLevel = 'pincode';
        targetLevelValues = [4, '4', 'pincode', 'Pincode Admin', 'pincode-admin', 'pincode_admin'];
    }

    if (!targetLevel) return [];

    const candidates = await User.find({
        $or: [
            { parentAdminId: { $in: [parent._id, String(parent._id), parent.id].filter(Boolean) } },
            { createdBy: { $in: [parent._id, String(parent._id), parent.id].filter(Boolean) } },
            { role: { $in: targetLevelValues } },
            { adminRole: { $in: targetLevelValues } },
            { adminLevel: { $in: targetLevelValues } },
            { level: { $in: targetLevelValues } }
        ],
        role: { $nin: ['Vendor', 'vendor', 'Member', 'member', 'customer', 'Customer', 'agent', 'state_manager', 'district_manager', 'division_manager', 'pincode_manager'] }
    })
    .select('name email phone mobile altPhone role adminRole adminLevel level assignedState state stateId assignedDistrict district districtId assignedDivision division divisionId assignedPincode pincode pincodeId postOffice fullAddress address addressLine1 addressLine2 locality taluk city dob dateOfBirth gender fatherName bloodGroup nationality aadharNumber aadhaarNumber panNumber bankName accountNumber accountHolderName ifscCode branchName bankDetails kyc kycDocs status isActive parentAdminId createdBy onboardedBy assignedBy registrationId id lastLogin createdAt updatedAt')
    .sort({ createdAt: 1 })
    .lean();

    const children = candidates.filter(c => {
        if (String(c._id) === String(parent._id)) return false;

        const cRawLvl = c.adminLevel || c.level;
        const cRawRole = (c.role || c.adminRole || '').toLowerCase();
        let cLevel = 'pincode';
        if (cRawLvl === 1 || cRawLvl === '1' || cRawLvl === 'state' || cRawRole.includes('state')) cLevel = 'state';
        else if (cRawLvl === 2 || cRawLvl === '2' || cRawLvl === 'district' || cRawRole.includes('district') || cRawRole.includes('branch')) cLevel = 'district';
        else if (cRawLvl === 3 || cRawLvl === '3' || cRawLvl === 'division' || cRawRole.includes('division')) cLevel = 'division';
        else if (cRawLvl === 4 || cRawLvl === '4' || cRawLvl === 'pincode' || cRawRole.includes('pincode')) cLevel = 'pincode';

        if (cLevel !== targetLevel) return false;

        // Check direct parent link first
        const isDirectChild = (
            (c.parentAdminId && [String(parent._id), String(parent.id)].includes(String(c.parentAdminId))) ||
            (c.createdBy && [String(parent._id), String(parent.id)].includes(String(c.createdBy)))
        );
        if (isDirectChild) return true;

        const cState = (c.assignedState || c.state || '').trim().toLowerCase();
        const cDist = (c.assignedDistrict || c.district || '').trim().toLowerCase();
        const cDiv = (c.assignedDivision || c.division || '').trim().toLowerCase();

        if (targetLevel === 'district') {
            return (c.stateId && parent.stateId && String(c.stateId) === String(parent.stateId)) ||
                   (cState && pState && cState === pState);
        }
        if (targetLevel === 'division') {
            const distMatch = (c.districtId && parent.districtId && String(c.districtId) === String(parent.districtId)) ||
                              (cDist && pDist && cDist === pDist);
            const stateMatch = (c.stateId && parent.stateId && String(c.stateId) === String(parent.stateId)) ||
                               (cState && pState && cState === pState) || !cState;
            return distMatch && stateMatch;
        }
        if (targetLevel === 'pincode') {
            const divMatch = (c.divisionId && parent.divisionId && String(c.divisionId) === String(parent.divisionId)) ||
                             (cDiv && pDiv && cDiv === pDiv);
            const distMatch = (c.districtId && parent.districtId && String(c.districtId) === String(parent.districtId)) ||
                              (cDist && pDist && cDist === pDist) || !cDist;
            return divMatch && distMatch;
        }
        return false;
    });

    return children.map(child => {
        const assignedState = child.assignedState || child.state || '—';
        const assignedDistrict = child.assignedDistrict || child.district || '—';
        const assignedDivision = child.assignedDivision || child.division || '—';
        const assignedPincode = child.assignedPincode ? String(child.assignedPincode) : (child.pincode ? String(child.pincode) : '—');

        return {
            _id: child._id,
            id: child._id,
            name: child.name,
            email: child.email,
            phone: child.phone || child.mobile || '—',
            mobile: child.mobile || child.phone || '—',
            altPhone: child.altPhone || child.alternatePhone || child.alternateMobile || child.altMobile || '',
            role: child.role || `${targetLevel}-admin`,
            adminRole: child.adminRole || `${targetLevel}-admin`,
            adminLevel: targetLevel,
            level: targetLevel,
            state: finalState,
            status: (child.status || 'Active').toLowerCase() === 'active' || child.status === 'approved' || child.isActive ? 'Active' : (child.status || 'Inactive'),
            isActive: child.isActive !== false,
            assignedState,
            assignedDistrict,
            assignedDivision,
            assignedPincode,
            state: child.state || assignedState,
            district: child.district || assignedDistrict,
            division: child.division || assignedDivision,
            pincode: child.pincode ? String(child.pincode) : assignedPincode,
            stateId: child.stateId || '',
            districtId: child.districtId || '',
            divisionId: child.divisionId || '',
            pincodeId: child.pincodeId || '',
            postOffice: child.postOffice || '—',
            address: child.addressLine1 || child.address || child.fullAddress || '',
            fullAddress: child.fullAddress || [child.addressLine1 || child.address, child.city, assignedDistrict !== '—' ? assignedDistrict : '', assignedState !== '—' ? assignedState : '', assignedPincode !== '—' ? assignedPincode : ''].filter(Boolean).join(', '),
            addressLine1: child.addressLine1 || child.address || '',
            addressLine2: child.addressLine2 || '',
            city: child.city || child.division || '',
            dob: child.dob || child.dateOfBirth || null,
            dateOfBirth: child.dateOfBirth || child.dob || null,
            gender: child.gender || child.kycDocs?.gender || child.kyc?.gender || null,
            fatherName: child.fatherName || child.kycDocs?.fatherName || '',
            bloodGroup: child.bloodGroup || child.kycDocs?.bloodGroup || '',
            nationality: child.nationality || child.kycDocs?.nationality || 'Indian',
            bankName: child.bankName || child.bankDetails?.bankName || '',
            accountNumber: child.accountNumber || child.bankDetails?.accountNumber || '',
            accountHolderName: child.accountHolderName || child.bankDetails?.accountHolderName || child.name || '',
            ifscCode: child.ifscCode || child.bankDetails?.ifscCode || '',
            branchName: child.branchName || child.bankDetails?.branchName || '',
            aadharNumber: child.aadharNumber || child.aadhaarNumber || child.kyc?.aadhaarNumber || child.kyc?.aadharNumber || '',
            aadhaarNumber: child.aadhaarNumber || child.aadharNumber || child.kyc?.aadhaarNumber || child.kyc?.aadharNumber || '',
            panNumber: child.panNumber || child.kyc?.panNumber || '',
            registrationId: child.registrationId || (typeof child._id === 'string' && child._id.startsWith('ADM-') ? child._id : `ADM-${String(child._id).slice(-6).toUpperCase()}`),
            parentAdminId: child.parentAdminId || parent._id,
            createdAt: child.createdAt || child.updatedAt || new Date(),
            lastLogin: child.lastLogin || null
        };
    });
};

router.get('/admins/:id/children', [auth, territoryScope], async (req, res) => {
    try {
        const parentId = req.params.id;
        if (['requests', 'activity', 'stats', 'export', 'dashboard'].includes(parentId)) {
            return res.status(404).json({ success: false, msg: 'Endpoint not found' });
        }
        const children = await getChildAdminsForParent(parentId);
        res.json({ success: true, children, total: children.length });
    } catch (err) {
        console.error('Get child admins error:', err);
        res.status(500).json({ success: false, msg: 'Server error retrieving child administrators', error: err.message });
    }
});

router.get('/hierarchy-admins/:id/children', [auth, territoryScope], async (req, res) => {
    try {
        const parentId = req.params.id;
        if (['requests', 'activity', 'stats', 'export', 'dashboard'].includes(parentId)) {
            return res.status(404).json({ success: false, msg: 'Endpoint not found' });
        }
        const children = await getChildAdminsForParent(parentId);
        res.json({ success: true, children, total: children.length });
    } catch (err) {
        console.error('Get child admins (hierarchy) error:', err);
        res.status(500).json({ success: false, msg: 'Server error retrieving child administrators', error: err.message });
    }
});

router.get('/hierarchy-admins/:id', [auth, territoryScope], getSingleAdminHandler);
router.get('/admins/:id', [auth, territoryScope], getSingleAdminHandler);

// ============================================================
// 2. CREATE HIERARCHY ADMIN (STRICT ONBOARDING ACCESS CONTROL)
// ============================================================
const createHierarchyAdminHandler = async (req, res) => {
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
            status = 'Active',
            // Extended personal details
            dateOfBirth,
            gender,
            fatherName,
            bloodGroup,
            nationality,
            // Extended address fields
            addressLine1,
            addressLine2,
            locality,
            city,
            taluk,
            residentialState,
            residentialDistrict,
            residentialPincode,
            // KYC document numbers (stored masked)
            aadhaarNumber,
            panNumber,
            aadhaarFrontUrl,
            aadhaarBackUrl,
            panUrl,
            addressProofType,
            addressProofNumber,
            addressProofUrl,
            photoUrl,
            // Declaration
            declarationAccepted
        } = req.body;

        if (!name || !name.trim()) return res.status(400).json({ msg: 'Full Name is required' });
        if (!email || !email.trim()) return res.status(400).json({ msg: 'Email is required' });
        if (!password || password.length < 6) return res.status(400).json({ msg: 'Password of at least 6 characters is required' });
        if (!adminLevel) return res.status(400).json({ msg: 'Admin Level is required' });

        // Minimum Age 18 Years Validation
        const rawDob = dateOfBirth || req.body.dob;
        if (rawDob) {
            const parts = String(rawDob).split('T')[0].split('-');
            const today = new Date();
            let age = 0;
            if (parts.length === 3 && !isNaN(parseInt(parts[0], 10))) {
                const birthYear = parseInt(parts[0], 10);
                const birthMonth = parseInt(parts[1], 10) - 1;
                const birthDay = parseInt(parts[2], 10);
                age = today.getFullYear() - birthYear;
                const m = today.getMonth() - birthMonth;
                if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
                    age--;
                }
            } else {
                const birthDate = new Date(rawDob);
                if (!isNaN(birthDate.getTime())) {
                    age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                }
            }
            if (age < 18) {
                return res.status(400).json({
                    success: false,
                    msg: 'You must be 18 years or older to register.',
                    message: 'You must be 18 years or older to register.'
                });
            }
        }

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
            if (req.adminUser.assignedState) finalState = req.adminUser.assignedState;
            if (req.adminUser.adminTier === 'district' && req.adminUser.assignedDistrict) {
                finalDistrict = req.adminUser.assignedDistrict;
            }
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

        // Strict Database Hierarchy Verification
        const terrValidation = await validateTerritoryHierarchy({
            state: finalState,
            district: ['district', 'division', 'pincode'].includes(targetLevel) ? finalDistrict : null,
            division: ['division', 'pincode'].includes(targetLevel) ? finalDivision : null,
            pincode: targetLevel === 'pincode' ? finalPincode : null,
            requireActive: true
        });

        if (!terrValidation.valid) {
            return res.status(400).json({ msg: terrValidation.message, error: 'INVALID_TERRITORY' });
        }

        if (terrValidation.data?.state) finalState = terrValidation.data.state.name;
        if (terrValidation.data?.district) finalDistrict = terrValidation.data.district.name;
        if (terrValidation.data?.division) finalDivision = terrValidation.data.division.name;
        if (terrValidation.data?.pincode) finalPincode = terrValidation.data.pincode.code;

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
                msg: existingUser.email === cleanEmail
                    ? 'An account with this email address already exists.'
                    : 'An account with this mobile number already exists.'
            });
        }

        // 5. KYC DUPLICATE CHECK (Aadhaar / PAN) — only if provided
        if (aadhaarNumber) {
            const cleanAadhaar = String(aadhaarNumber).replace(/\s/g, '');
            if (cleanAadhaar.length !== 12 || !/^\d{12}$/.test(cleanAadhaar)) {
                return res.status(400).json({ msg: 'Aadhaar number must be exactly 12 digits.' });
            }
            const aadhaarExists = await User.findOne({ 'kyc.aadhaarNumber': cleanAadhaar });
            if (aadhaarExists) {
                return res.status(400).json({ msg: 'An account with this Aadhaar number already exists.' });
            }
        }

        if (panNumber) {
            const cleanPan = String(panNumber).trim().toUpperCase();
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
                return res.status(400).json({ msg: 'Invalid PAN number format. Expected format: ABCDE1234F' });
            }
            const panExists = await User.findOne({ 'kyc.panNumber': cleanPan });
            if (panExists) {
                return res.status(400).json({ msg: 'An account with this PAN number already exists.' });
            }
        }

        // 6. AUTO-ENSURE STATE IN STATE COLLECTION IF NOT EXISTS
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

        // 7. ENFORCE STATE ADMINISTRATOR CAPACITY LIMIT (MAXIMUM 4 PER STATE INDEPENDENTLY)
        if (targetLevel === 'state' && finalState) {
            const stateRegex = new RegExp(`^${finalState.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            const qualifyingCount = await User.countDocuments({
                role: 'admin',
                $or: [
                    { adminLevel: 'state' },
                    { level: 'state' },
                    { adminRole: 'state-admin' }
                ],
                email: { $ne: 'admin@example.com' },
                $or: [
                    { assignedState: stateRegex },
                    { state: stateRegex }
                ],
                status: { $nin: ['deleted', 'rejected', 'revoked'] },
                isDeleted: { $ne: true }
            });

            if (qualifyingCount >= 4) {
                return res.status(400).json({
                    success: false,
                    msg: 'This state has reached its maximum capacity of 4 State Administrators.',
                    message: 'This state has reached its maximum capacity of 4 State Administrators.'
                });
            }
        }

        // 8. GENERATE REGISTRATION ID & ROLE
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randDigits = Math.floor(1000 + Math.random() * 9000);
        const stateCode = finalState ? finalState.slice(0, 2).toUpperCase() : 'XX';
        const registrationId = `ADM-${stateCode}-${dateStr}-${randDigits}`;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Build full residential address string
        const addressParts = [addressLine1, addressLine2, locality, city, taluk, residentialDistrict, residentialState, residentialPincode].filter(Boolean);
        const fullResidentialAddress = address || addressParts.join(', ') || '';

        // Mask Aadhaar for storage (only store last 4 digits visible)
        const maskedAadhaar = aadhaarNumber
            ? `XXXX XXXX ${String(aadhaarNumber).replace(/\s/g, '').slice(-4)}`
            : undefined;

        const isAccountActive = (!status || status === 'Active' || status === 'approved' || status === 'active');
        const newAdmin = new User({
            name: name.trim(),
            email: cleanEmail,
            phone: cleanPhone || undefined,
            altPhone: altPhone ? String(altPhone).replace(/\D/g, '') : '',
            password: hashedPassword,
            passwordHash: hashedPassword,
            role: 'admin',
            adminRole: `${targetLevel}-admin`,
            adminLevel: targetLevel,
            assignedState: finalState,
            assignedDistrict: finalDistrict,
            assignedDivision: finalDivision,
            assignedPincode: finalPincode,
            postOffice: postOffice || '',
            fullAddress: fullResidentialAddress,
            // Extended personal details stored in existing User model fields
            dob: dateOfBirth || undefined,
            gender: gender || undefined,
            // Store additional details in kycDocs (Mixed field)
            kycDocs: {
                fatherName: fatherName || '',
                bloodGroup: bloodGroup || '',
                nationality: nationality || 'Indian',
                addressLine1: addressLine1 || '',
                addressLine2: addressLine2 || '',
                locality: locality || '',
                city: city || '',
                taluk: taluk || '',
                residentialDistrict: residentialDistrict || '',
                residentialState: residentialState || '',
                residentialPincode: residentialPincode || '',
                photoUrl: photoUrl || '',
                addressProofType: addressProofType || '',
                addressProofNumber: addressProofNumber || '',
                addressProofUrl: addressProofUrl || '',
                declarationAccepted: !!declarationAccepted,
                onboardedAt: new Date().toISOString()
            },
            // KYC document data stored in existing kyc subdocument
            kyc: {
                aadhaarNumber: maskedAadhaar || '',
                aadhaarImage: aadhaarFrontUrl || '',
                panNumber: panNumber ? String(panNumber).trim().toUpperCase() : '',
                panImage: panUrl || '',
                selfie: photoUrl || ''
            },
            status: isAccountActive ? 'approved' : (status === 'Pending Verification' ? 'pending' : status),
            isActive: isAccountActive,
            parentAdminId: req.adminUser._id,
            registrationId,
            createdAt: new Date()
        });

        // Concurrency-safe capacity re-check immediately prior to persistence
        if (targetLevel === 'state' && finalState) {
            const stateRegex = new RegExp(`^${finalState.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            const recheckCount = await User.countDocuments({
                role: 'admin',
                $or: [{ adminLevel: 'state' }, { level: 'state' }, { adminRole: 'state-admin' }],
                email: { $ne: 'admin@example.com' },
                $or: [{ assignedState: stateRegex }, { state: stateRegex }],
                status: { $nin: ['deleted', 'rejected', 'revoked'] },
                isDeleted: { $ne: true }
            });
            if (recheckCount >= 4) {
                return res.status(400).json({
                    success: false,
                    msg: 'This state has reached its maximum capacity of 4 State Administrators.',
                    message: 'This state has reached its maximum capacity of 4 State Administrators.'
                });
            }
        }

        await newAdmin.save();

        res.status(201).json({
            success: true,
            msg: `${targetLevel.charAt(0).toUpperCase() + targetLevel.slice(1)} Administrator onboarded successfully.`,
            registrationId,
            admin: await formatAdminForResponse(newAdmin.toObject())
        });
    } catch (err) {
        console.error('Create hierarchy admin error:', err);
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue || {})[0];
            const fieldLabels = { email: 'Email address', phone: 'Mobile number' };
            return res.status(400).json({ msg: `${fieldLabels[field] || 'This'} is already registered.` });
        }
        res.status(500).json({ msg: 'Server error creating administrator', error: err.message });
    }
};

router.post('/hierarchy-admins', [auth, territoryScope], createHierarchyAdminHandler);
router.post('/admins', [auth, territoryScope], createHierarchyAdminHandler);

// ============================================================
// 3. UPDATE & DELETE HIERARCHY ADMIN STATUS & DETAILS
// ============================================================
const updateHierarchyAdminHandler = async (req, res) => {
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
            const updatedHashedPw = await bcrypt.hash(password, salt);
            targetAdmin.password = updatedHashedPw;
            targetAdmin.passwordHash = updatedHashedPw;
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
};

const deleteHierarchyAdminHandler = async (req, res) => {
    try {
        const targetAdmin = await User.findById(req.params.id);
        if (!targetAdmin) return res.status(404).json({ msg: 'Administrator not found' });
        if (!req.adminUser.isMainAdmin) {
            const callerState = (req.adminUser.assignedState || '').toLowerCase();
            const targetState = (targetAdmin.assignedState || '').toLowerCase();
            if (callerState !== targetState) {
                return res.status(403).json({ msg: 'Cross-territory deletion forbidden.' });
            }
        }
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, msg: 'Administrator deleted successfully' });
    } catch (err) {
        console.error('Delete hierarchy admin error:', err);
        res.status(500).json({ msg: 'Server error deleting administrator', error: err.message });
    }
};

const deleteStateAdminsHandler = async (req, res) => {
    try {
        const stateName = decodeURIComponent(req.params.stateName || '').trim();
        if (!stateName) return res.status(400).json({ success: false, msg: 'State name is required' });
        if (!req.adminUser.isMainAdmin) {
            return res.status(403).json({ success: false, msg: 'Only Super Admin can delete state territory' });
        }
        const deleteResult = await User.deleteMany({
            role: { $in: ['admin'] },
            adminRole: { $nin: ['super-admin'] },
            $or: [
                { assignedState: new RegExp(`^${stateName}$`, 'i') },
                { state: new RegExp(`^${stateName}$`, 'i') }
            ]
        });
        res.json({
            success: true,
            msg: `State '${stateName}' deleted successfully (${deleteResult.deletedCount || 0} admins removed)`,
            deletedCount: deleteResult.deletedCount
        });
    } catch (err) {
        console.error('Delete state admins error:', err);
        res.status(500).json({ success: false, msg: 'Server error deleting state', error: err.message });
    }
};

router.put('/hierarchy-admins/:id', [auth, territoryScope], updateHierarchyAdminHandler);
router.put('/admins/:id', [auth, territoryScope], updateHierarchyAdminHandler);

router.delete('/hierarchy-admins/:id', [auth, territoryScope], deleteHierarchyAdminHandler);
router.delete('/admins/:id', [auth, territoryScope], deleteHierarchyAdminHandler);
router.delete('/admins/state/:stateName', [auth, territoryScope], deleteStateAdminsHandler);

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

        const [rawManagers, rawUsers] = await Promise.all([
            Manager.find(query)
                .populate('parentAdminId', 'name email role adminRole')
                .populate('approvedBy', 'name email')
                .sort({ createdAt: -1 })
                .lean()
                .catch(() => []),
            User.find({
                role: { $in: ['state_manager', 'district_manager', 'division_manager', 'pincode_manager', 'manager'] }
            }).sort({ createdAt: -1 }).lean().catch(() => [])
        ]);

        const all = [];
        const seen = new Set();
        const normalize = (m) => {
            const id = String(m._id || m.id);
            const em = String(m.email || '').toLowerCase().trim();
            if (seen.has(id) || (em && seen.has(em))) return;
            if (id) seen.add(id);
            if (em) seen.add(em);
            const lvl = m.level === 1 ? 'state' : m.level === 2 ? 'district' : m.level === 3 ? 'division' : m.level === 4 ? 'pincode' : String(m.level || m.role || 'state').replace('_manager', '');
            all.push({
                ...m,
                _id: m._id,
                id: m.id || m.managerId || `MGR-${lvl.toUpperCase().slice(0, 3)}-${id.slice(-6)}`,
                managerId: m.managerId || m.id || `MGR-${lvl.toUpperCase().slice(0, 3)}-${id.slice(-6)}`,
                level: lvl,
                assignedState: m.assignedState || m.state || '',
                assignedDistrict: m.assignedDistrict || m.district || '',
                assignedDivision: m.assignedDivision || m.division || '',
                assignedPincode: m.assignedPincode ? String(m.assignedPincode) : (m.pincode ? String(m.pincode) : ''),
                phone: m.phone || m.mobile || '',
                mobile: m.mobile || m.phone || '',
                status: (m.status === 'approved' || m.status === 'active' || m.status === 'Active') ? 'Active' : (m.status || 'Active')
            });
        };
        rawManagers.forEach(normalize);
        rawUsers.forEach(normalize);

        res.json({
            success: true,
            managers: all,
            total: all.length
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

        // Strict Database Hierarchy Verification
        const terrValidation = await validateTerritoryHierarchy({
            state: finalState,
            district: ['district', 'division', 'pincode'].includes(targetLevel) ? finalDistrict : null,
            division: ['division', 'pincode'].includes(targetLevel) ? finalDivision : null,
            pincode: targetLevel === 'pincode' ? finalPincode : null,
            requireActive: true
        });

        if (!terrValidation.valid) {
            return res.status(400).json({ msg: terrValidation.message, error: 'INVALID_TERRITORY' });
        }

        if (terrValidation.data?.state) finalState = terrValidation.data.state.name;
        if (terrValidation.data?.district) finalDistrict = terrValidation.data.district.name;
        if (terrValidation.data?.division) finalDivision = terrValidation.data.division.name;
        if (terrValidation.data?.pincode) finalPincode = terrValidation.data.pincode.code;

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
        const mReq = await ManagerRequest.findById(req.params.id);
        if (!mReq) return res.status(404).json({ msg: 'Manager request not found' });
        if (mReq.status === 'Approved') return res.status(400).json({ msg: 'Request is already approved' });

        // Territory Authorization Check for Sub-Admins
        if (!req.adminUser.isMainAdmin) {
            const adminTier = (req.adminUser.adminTier || '').toLowerCase();
            let territoryMatches = false;
            if (adminTier === 'state' && req.adminUser.assignedState && req.adminUser.assignedState.toLowerCase() === (mReq.assignedState || '').toLowerCase()) {
                territoryMatches = true;
            } else if (adminTier === 'district' && req.adminUser.assignedDistrict && req.adminUser.assignedDistrict.toLowerCase() === (mReq.assignedDistrict || '').toLowerCase()) {
                territoryMatches = true;
            } else if (adminTier === 'division' && req.adminUser.assignedDivision && req.adminUser.assignedDivision.toLowerCase() === (mReq.assignedDivision || '').toLowerCase()) {
                territoryMatches = true;
            } else if (adminTier === 'pincode' && req.adminUser.assignedPincode && String(req.adminUser.assignedPincode) === String(mReq.assignedPincode || '')) {
                territoryMatches = true;
            }
            if (!territoryMatches) {
                return res.status(403).json({ msg: 'Unauthorized. You can only review manager onboarding requests within your assigned territory.' });
            }
        }

        const isKycStage = req.query.stage === 'kyc' || req.body.stage === 'kyc' || mReq.approvalStage === 'kyc_review' || (req.adminUser.isMainAdmin && req.body.directActivate);

        if (!isKycStage && !req.adminUser.isMainAdmin) {
            // STAGE 1: SUB-ADMIN TERRITORY APPROVAL
            mReq.approvalStage = 'kyc_review';
            mReq.subadminApprovedBy = req.adminUser._id;
            mReq.subadminApprovedByName = req.adminUser.name;
            mReq.subadminApprovedAt = new Date();
            mReq.status = 'Pending';
            await mReq.save();

            const userFilter = mReq.userId ? { _id: mReq.userId } : { email: mReq.email.toLowerCase().trim() };
            await User.findOneAndUpdate(userFilter, {
                status: 'under_review',
                approvalStage: 'kyc_review',
                kycStatus: 'pending_verification',
                subadminApprovedBy: req.adminUser._id,
                subadminApprovedByName: req.adminUser.name,
                subadminApprovedAt: new Date()
            });

            try {
                const io = req.app.get('io');
                if (io) {
                    const payload = {
                        _id: mReq._id,
                        requestId: mReq.requestId,
                        name: mReq.name,
                        email: mReq.email,
                        level: mReq.level,
                        approvalStage: 'kyc_review',
                        subadminApprovedByName: req.adminUser.name,
                        createdAt: new Date()
                    };
                    io.to('admin').emit('manager_stage1_approved', payload);
                    io.to('admin').emit('new_kyc_request', payload);
                }
            } catch (ioErr) {}

            return res.json({
                success: true,
                stage: 'kyc_review',
                msg: `Stage 1 territory review approved by ${req.adminUser.name}. Sent to KYC verification team for review.`,
                request: mReq
            });
        }

        // STAGE 2: KYC TEAM / MAIN ADMIN FINAL APPROVAL
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
        const rawReqLvl = mReq.level ?? 'GEN';
        const lvlCode = (rawReqLvl === 1 || rawReqLvl === '1') ? 'STM'
            : (rawReqLvl === 2 || rawReqLvl === '2') ? 'DTM'
            : (rawReqLvl === 3 || rawReqLvl === '3') ? 'DIV'
            : (rawReqLvl === 4 || rawReqLvl === '4') ? 'PIN'
            : String(rawReqLvl).slice(0, 3).toUpperCase();
        const managerId = `MGR-${lvlCode}-${dateStr}-${randDigits}`;

        // Create Manager in Manager Collection
        let newManager = await Manager.findOne({
            $or: [
                { email: mReq.email.toLowerCase().trim() },
                { managerId: mReq.requestId }
            ]
        });

        if (!newManager) {
            newManager = new Manager({
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
                parentAdminId: mReq.requestedBy || req.adminUser._id,
                requestedBy: mReq.requestedBy,
                approvedBy: req.adminUser._id,
                status: 'Active',
                notes: mReq.notes
            });
            await newManager.save();
        } else {
            newManager.status = 'Active';
            newManager.approvedBy = req.adminUser._id;
            await newManager.save();
        }

        mReq.status = 'Approved';
        mReq.approvalStage = 'approved';
        mReq.kycApprovedBy = req.adminUser._id;
        mReq.kycApprovedByName = req.adminUser.name;
        mReq.kycApprovedAt = new Date();
        mReq.reviewedBy = req.adminUser._id;
        mReq.reviewedAt = new Date();
        await mReq.save();

        const userFilter = mReq.userId ? { _id: mReq.userId } : { email: mReq.email.toLowerCase().trim() };
        await User.findOneAndUpdate(userFilter, {
            status: 'active',
            approvalStage: 'approved',
            kycStatus: 'Verified',
            isActive: true,
            isApproved: true,
            managerId: newManager.managerId
        });

        try {
            const io = req.app.get('io');
            if (io) {
                io.to('admin').emit('manager_activated', {
                    id: newManager._id,
                    managerId: newManager.managerId,
                    name: newManager.name,
                    email: newManager.email,
                    level: mReq.level,
                    status: 'Active'
                });
            }
        } catch (ioErr) {}

        res.json({
            success: true,
            stage: 'approved',
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
// 8. REJECT MANAGER REQUEST
// ============================================================
router.put('/managers/requests/:id/reject', [auth, territoryScope], async (req, res) => {
    try {
        const mReq = await ManagerRequest.findById(req.params.id);
        if (!mReq) return res.status(404).json({ msg: 'Manager request not found' });

        if (!req.adminUser.isMainAdmin) {
            const adminTier = (req.adminUser.adminTier || '').toLowerCase();
            let territoryMatches = false;
            if (adminTier === 'state' && req.adminUser.assignedState && req.adminUser.assignedState.toLowerCase() === (mReq.assignedState || '').toLowerCase()) {
                territoryMatches = true;
            } else if (adminTier === 'district' && req.adminUser.assignedDistrict && req.adminUser.assignedDistrict.toLowerCase() === (mReq.assignedDistrict || '').toLowerCase()) {
                territoryMatches = true;
            } else if (adminTier === 'division' && req.adminUser.assignedDivision && req.adminUser.assignedDivision.toLowerCase() === (mReq.assignedDivision || '').toLowerCase()) {
                territoryMatches = true;
            } else if (adminTier === 'pincode' && req.adminUser.assignedPincode && String(req.adminUser.assignedPincode) === String(mReq.assignedPincode || '')) {
                territoryMatches = true;
            }
            if (!territoryMatches) {
                return res.status(403).json({ msg: 'Unauthorized. You can only reject manager onboarding requests within your assigned territory.' });
            }
        }

        const rejectionReason = req.body.reason || req.body.rejectionReason || 'Rejected by Administrator';

        mReq.status = 'Rejected';
        mReq.approvalStage = 'rejected';
        mReq.rejectionReason = rejectionReason;
        mReq.reviewedBy = req.adminUser._id;
        mReq.reviewedAt = new Date();
        await mReq.save();

        const userFilter = mReq.userId ? { _id: mReq.userId } : { email: mReq.email.toLowerCase().trim() };
        await User.findOneAndUpdate(userFilter, {
            status: 'rejected',
            approvalStage: 'rejected',
            rejectionReason
        });

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

        // States: Single source of truth from State collection in MongoDB
        let statesList = [];
        if (!req.adminUser.isMainAdmin && req.adminUser.assignedState) {
            statesList = [req.adminUser.assignedState];
        } else {
            const activeStates = await State.find({ status: 'Active' }).sort({ name: 1 }).lean();
            statesList = activeStates.map(s => s.name);
        }

        // Districts for selected state: strictly belonging to stateId
        let districtsList = [];
        const targetState = state || req.adminUser.assignedState;
        let matchedStateDoc = null;
        if (targetState) {
            matchedStateDoc = await State.findOne({
                $and: [
                    { status: 'Active' },
                    {
                        $or: [
                            { name: new RegExp(`^${targetState.trim()}$`, 'i') },
                            { code: targetState.trim().toUpperCase() }
                        ]
                    }
                ]
            });

            if (matchedStateDoc) {
                const dbDistricts = await District.find({ stateId: matchedStateDoc._id, status: 'Active' }).sort({ name: 1 }).lean();
                districtsList = dbDistricts.map(d => d.name);
            }
        }

        // Divisions for selected district: strictly belonging to districtId
        let divisionsList = [];
        const targetDistrict = district || req.adminUser.assignedDistrict;
        let matchedDistDoc = null;
        if (targetDistrict && matchedStateDoc) {
            matchedDistDoc = await District.findOne({
                stateId: matchedStateDoc._id,
                name: new RegExp(`^${targetDistrict.trim()}$`, 'i'),
                status: 'Active'
            });

            if (matchedDistDoc) {
                const dbDivisions = await Division.find({ districtId: matchedDistDoc._id, status: 'Active' }).sort({ name: 1 }).lean();
                divisionsList = dbDivisions.map(d => d.name);
            }
        }

        // Pincodes for selected division: strictly belonging to divisionId
        let pincodesList = [];
        const targetDivision = division || req.adminUser.assignedDivision;
        if (targetDivision && matchedDistDoc) {
            const matchedDivDoc = await Division.findOne({
                districtId: matchedDistDoc._id,
                name: new RegExp(`^${targetDivision.trim()}$`, 'i'),
                status: 'Active'
            });

            if (matchedDivDoc) {
                const pins = await Pincode.find({ divisionId: matchedDivDoc._id, status: 'Active' }).select('code name postOffice').sort({ code: 1 }).lean();
                pincodesList = pins.map(p => ({
                    code: p.code,
                    name: p.name || p.postOffice || p.code,
                    postOffice: p.postOffice || ''
                }));
            }
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
