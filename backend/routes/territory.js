const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const State = require('../models/State');
const District = require('../models/District');
const Division = require('../models/Division');
const Pincode = require('../models/Pincode');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const TerritoryAuditLog = require('../models/TerritoryAuditLog');

// Optional authentication middleware: Populates req.user if a valid token is provided, but allows public read-only territory access
const optionalAuth = async (req, res, next) => {
    try {
        let token = req.header('x-auth-token');
        const authHeader = req.header('Authorization') || req.header('authorization');
        if (!token && authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
        if (token) {
            const secrets = [
                process.env.JWT_SECRET,
                'connect_secret_key_prod_2026',
                'secretKey123',
                'your-super-secret-jwt-key-change-in-production'
            ].filter(Boolean);

            let decoded = null;
            for (const s of secrets) {
                try {
                    decoded = jwt.verify(token, s);
                    if (decoded) break;
                } catch (e) {}
            }

            if (decoded) {
                let userObj = decoded.user || decoded;
                if (userObj.id && mongoose.Types.ObjectId.isValid(userObj.id)) {
                    try {
                        const dbUser = await User.findById(userObj.id).select('role adminRole level assignedState assignedDistrict assignedArea assignedPincode state district division pincode name email').lean();
                        if (dbUser) {
                            userObj = { ...dbUser, ...userObj };
                        }
                    } catch (dbErr) {}
                }
                req.user = userObj;
            }
        }
    } catch (e) {
        // Guest access permitted for public territory dropdowns
    }
    next();
};

// Helper: Determine territory access control scope based on user role and level
const getTerritoryScope = (user) => {
    if (!user) return null; // Guest or unauthenticated -> public catalog

    const role = (user.role || user.adminRole || '').toLowerCase().trim();
    const level = (user.level || '').toLowerCase().trim();

    // Super Admin / System Admin: unrestricted access
    if (['admin', 'super-admin', 'superadmin', 'super admin'].includes(role) && (!level || level === 'super' || level === 'all')) {
        return { isSuperAdmin: true };
    }

    const state = (user.state || user.assignedState || '').trim();
    const district = (user.district || user.assignedDistrict || '').trim();
    const division = (user.division || user.assignedDivision || user.assignedArea || '').trim();
    const pincode = user.pincode || user.assignedPincode || null;

    if (role.includes('state') || level === 'state') {
        return { role: 'state', state };
    }
    if (role.includes('district') || level === 'district') {
        return { role: 'district', state, district };
    }
    if (role.includes('division') || level === 'division') {
        return { role: 'division', state, district, division };
    }
    if (role.includes('pincode') || level === 'pincode') {
        return { role: 'pincode', state, district, division, pincode: pincode ? String(pincode).trim() : null };
    }
    if (role === 'agent') {
        if (level === 'state') return { role: 'state', state };
        if (level === 'district') return { role: 'district', state, district };
        if (level === 'division') return { role: 'division', state, district, division };
        return { role: 'pincode', state, district, division, pincode: pincode ? String(pincode).trim() : null };
    }

    if (state || district || division || pincode) {
        return { role: 'custom', state, district, division, pincode: pincode ? String(pincode).trim() : null };
    }

    return null;
};

// Administrator authentication middleware
const superAdminAuth = async (req, res, next) => {
    try {
        let userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ msg: 'Unauthorized: User identity not found' });
        }
        if (mongoose.Types.ObjectId.isValid(userId)) {
            userId = new mongoose.Types.ObjectId(userId);
        }
        const user = await User.findById(userId).select('role adminRole level status isActive email name').lean();
        if (!user) {
            return res.status(401).json({ msg: 'Unauthorized: User not found in database' });
        }
        const roleVal = (user.role || '').toLowerCase().trim();
        const adminRoleVal = (user.adminRole || '').toLowerCase().trim();
        const isAdmin = ['admin', 'super-admin'].includes(roleVal) || ['admin', 'super-admin'].includes(adminRoleVal);

        if (!isAdmin) {
            return res.status(403).json({ msg: 'Access denied. Administrative privilege required for geographic modification.' });
        }
        req.adminUser = user;
        next();
    } catch (err) {
        console.error('Territory admin middleware error:', err);
        res.status(500).json({ msg: 'Server authentication failure' });
    }
};

// Helper: Log audit action
const logAudit = async (req, action, territoryType, territoryId, territoryName, prevVal = null, newVal = null, reason = '') => {
    try {
        await TerritoryAuditLog.create({
            action,
            actorId: req.adminUser?._id || req.user?.id || null,
            actorName: req.adminUser?.name || 'Administrator',
            actorRole: req.adminUser?.role || 'super-admin',
            territoryId: String(territoryId || ''),
            territoryType,
            territoryName: String(territoryName || ''),
            previousValue: prevVal,
            newValue: newVal,
            reason,
            ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1'
        });
    } catch (err) {
        console.error('Failed to log territory audit:', err.message);
    }
};

// Helper: Auto-sync existing Pincodes in database to State/District/Division models
const autoSyncExistingPincodes = async () => {
    try {
        const unlinkedPins = await Pincode.find({ stateId: null }).limit(100);
        for (const pin of unlinkedPins) {
            if (!pin.state || !pin.district) continue;

            const stName = pin.state.trim();
            const distName = pin.district.trim();
            const divName = (pin.division || 'Central').trim();

            // 1. Ensure State
            let st = await State.findOne({ name: new RegExp(`^${stName}$`, 'i') });
            if (!st) {
                const cleanCode = stName.substring(0, 3).toUpperCase();
                st = await State.create({
                    stateId: `ST-${cleanCode}-${Date.now().toString().slice(-4)}`,
                    name: stName,
                    code: cleanCode,
                    status: 'Active'
                });
            }

            // 2. Ensure District
            let dist = await District.findOne({ stateId: st._id, name: new RegExp(`^${distName}$`, 'i') });
            if (!dist) {
                const distCode = distName.substring(0, 4).toUpperCase();
                dist = await District.create({
                    districtId: `DIST-${distCode}-${Date.now().toString().slice(-4)}`,
                    stateId: st._id,
                    name: distName,
                    code: distCode,
                    status: 'Active'
                });
            }

            // 3. Ensure Division
            let div = await Division.findOne({ districtId: dist._id, name: new RegExp(`^${divName}$`, 'i') });
            if (!div) {
                const divCode = divName.substring(0, 3).toUpperCase();
                div = await Division.create({
                    divisionId: `DIV-${divCode}-${Date.now().toString().slice(-4)}`,
                    stateId: st._id,
                    districtId: dist._id,
                    name: divName,
                    code: divCode,
                    divisionType: 'Administrative',
                    status: 'Active'
                });
            }

            // 4. Link Pincode
            pin.stateId = st._id;
            pin.districtId = dist._id;
            pin.divisionId = div._id;
            if (!pin.pincodeId) {
                pin.pincodeId = `PIN-${pin.code}`;
            }
            if (!pin.status) {
                pin.status = 'Active';
            }
            await pin.save();
        }
    } catch (err) {
        console.error('Auto-sync pincodes warning:', err.message);
    }
};

// ============================================================
// 1. TERRITORY HIERARCHY TREE & AGGREGATE SUMMARY
// ============================================================
router.get('/hierarchy', [optionalAuth], async (req, res) => {
    try {
        await autoSyncExistingPincodes();

        const onlyActive = req.query.status ? req.query.status.toLowerCase() !== 'all' : true;
        const statusFilter = onlyActive ? { status: 'Active' } : {};

        // Fetch all states, districts, divisions, and pincodes
        let [states, districts, divisions, pincodes, agents, vendors] = await Promise.all([
            State.find(statusFilter).sort({ name: 1 }).lean(),
            District.find(statusFilter).sort({ name: 1 }).lean(),
            Division.find(statusFilter).sort({ name: 1 }).lean(),
            Pincode.find(statusFilter).populate('activeAgentId', 'name email phone level').sort({ code: 1 }).lean(),
            User.find({ role: 'agent', isActive: { $ne: false } }).select('name email phone level assignedState assignedDistrict assignedArea assignedPincode').lean(),
            Vendor.find().select('name businessName state district pincode status').lean()
        ]);

        // Territory-Based Access Control Scoping
        const scope = getTerritoryScope(req.user);
        if (scope && !scope.isSuperAdmin) {
            if (scope.state) {
                const matchingStateIds = new Set(states.filter(s => s.name?.toLowerCase() === scope.state.toLowerCase() || s.code?.toLowerCase() === scope.state.toLowerCase()).map(s => s._id.toString()));
                states = states.filter(s => matchingStateIds.has(s._id.toString()));
                districts = districts.filter(d => d.stateId && matchingStateIds.has(d.stateId.toString()));
            }
            if (scope.district) {
                const matchingDistIds = new Set(districts.filter(d => d.name?.toLowerCase() === scope.district.toLowerCase() || d.code?.toLowerCase() === scope.district.toLowerCase()).map(d => d._id.toString()));
                districts = districts.filter(d => matchingDistIds.has(d._id.toString()));
                divisions = divisions.filter(div => div.districtId && matchingDistIds.has(div.districtId.toString()));
            }
            if (scope.division) {
                const matchingDivIds = new Set(divisions.filter(div => div.name?.toLowerCase() === scope.division.toLowerCase() || div.code?.toLowerCase() === scope.division.toLowerCase() || div.name?.toLowerCase().includes(scope.division.toLowerCase())).map(div => div._id.toString()));
                divisions = divisions.filter(div => matchingDivIds.has(div._id.toString()));
                pincodes = pincodes.filter(pin => pin.divisionId && matchingDivIds.has(pin.divisionId.toString()));
            }
            if (scope.pincode) {
                pincodes = pincodes.filter(pin => String(pin.code) === String(scope.pincode));
            }
        }

        // Build index maps for fast tree assembly
        const stateMap = {};
        states.forEach(st => {
            stateMap[st._id.toString()] = {
                ...st,
                districts: [],
                totalDistricts: 0,
                totalDivisions: 0,
                totalPincodes: 0,
                activePincodes: 0,
                managers: agents.filter(a => (a.level || '').toLowerCase() === 'state' && (a.assignedState === st.name || a.assignedState === st.code)),
                vendorsCount: vendors.filter(v => (v.state || '').toLowerCase() === st.name.toLowerCase()).length
            };
        });

        const districtMap = {};
        districts.forEach(dst => {
            districtMap[dst._id.toString()] = {
                ...dst,
                divisions: [],
                totalDivisions: 0,
                totalPincodes: 0,
                activePincodes: 0,
                managers: agents.filter(a => (a.level || '').toLowerCase() === 'district' && (a.assignedDistrict === dst.name || a.assignedDistrict === dst.code)),
                vendorsCount: vendors.filter(v => (v.district || '').toLowerCase() === dst.name.toLowerCase()).length
            };
        });

        const divisionMap = {};
        divisions.forEach(div => {
            divisionMap[div._id.toString()] = {
                ...div,
                pincodes: [],
                totalPincodes: 0,
                activePincodes: 0,
                managers: agents.filter(a => (a.level || '').toLowerCase() === 'division' && ((a.assignedArea || '').includes(div.name) || (a.assignedDistrict === div.name))),
                vendorsCount: 0
            };
        });

        // Nest Pincodes into Divisions
        pincodes.forEach(pin => {
            const divIdStr = pin.divisionId ? pin.divisionId.toString() : null;
            if (divIdStr && divisionMap[divIdStr]) {
                divisionMap[divIdStr].pincodes.push(pin);
                divisionMap[divIdStr].totalPincodes += 1;
                if (pin.status === 'Active') divisionMap[divIdStr].activePincodes += 1;
            }
        });

        // Nest Divisions into Districts
        Object.values(divisionMap).forEach(div => {
            const distIdStr = div.districtId ? div.districtId.toString() : null;
            if (distIdStr && districtMap[distIdStr]) {
                districtMap[distIdStr].divisions.push(div);
                districtMap[distIdStr].totalDivisions += 1;
                districtMap[distIdStr].totalPincodes += div.totalPincodes;
                districtMap[distIdStr].activePincodes += div.activePincodes;
            }
        });

        // Nest Districts into States
        Object.values(districtMap).forEach(dst => {
            const stIdStr = dst.stateId ? dst.stateId.toString() : null;
            if (stIdStr && stateMap[stIdStr]) {
                stateMap[stIdStr].districts.push(dst);
                stateMap[stIdStr].totalDistricts += 1;
                stateMap[stIdStr].totalDivisions += dst.totalDivisions;
                stateMap[stIdStr].totalPincodes += dst.totalPincodes;
                stateMap[stIdStr].activePincodes += dst.activePincodes;
            }
        });

        const hierarchyList = Object.values(stateMap);
        res.json({
            success: true,
            hierarchy: hierarchyList,
            states: hierarchyList,
            rawDistricts: districts,
            rawDivisions: divisions,
            rawPincodes: pincodes,
            totalStates: states.length,
            totalDistricts: districts.length,
            totalDivisions: divisions.length,
            totalPincodes: pincodes.length,
            totalAgents: agents.length
        });
    } catch (err) {
        console.error('Failed to get territory hierarchy:', err);
        res.status(500).json({ success: false, msg: 'Error retrieving territory hierarchy' });
    }
});

// ============================================================
// 2. SUMMARY KPI STATS
// ============================================================
router.get('/stats', [optionalAuth], async (req, res) => {
    try {
        const [statesCount, districtsCount, divisionsCount, pincodesCount, activePincodesCount, assignedPincodesCount, agentsCount] = await Promise.all([
            State.countDocuments({ status: 'Active' }),
            District.countDocuments({ status: 'Active' }),
            Division.countDocuments({ status: 'Active' }),
            Pincode.countDocuments(),
            Pincode.countDocuments({ status: 'Active' }),
            Pincode.countDocuments({ activeAgentId: { $ne: null } }),
            User.countDocuments({ role: 'agent', isActive: { $ne: false } })
        ]);

        res.json({
            success: true,
            stats: {
                totalStates: statesCount,
                totalDistricts: districtsCount,
                totalDivisions: divisionsCount,
                totalPincodes: pincodesCount,
                activePincodes: activePincodesCount,
                assignedPincodes: assignedPincodesCount,
                availablePincodes: Math.max(0, pincodesCount - assignedPincodesCount),
                activeManagers: agentsCount
            }
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ success: false, msg: 'Error calculating territory stats' });
    }
});

// ============================================================
// 3. STATE CRUD
// ============================================================
router.get('/states', [optionalAuth], async (req, res) => {
    try {
        const filter = {};
        if (req.query.status && req.query.status.toLowerCase() !== 'all') {
            filter.status = req.query.status;
        } else if (!req.query.status) {
            filter.status = 'Active'; // Requirement 12: default to Active
        }

        const scope = getTerritoryScope(req.user);
        if (scope && !scope.isSuperAdmin && scope.state) {
            filter.$or = [
                { name: new RegExp('^' + scope.state + '$', 'i') },
                { code: scope.state.toUpperCase() }
            ];
        }

        const states = await State.find(filter).sort({ name: 1 });
        res.json(states);
    } catch (err) {
        res.status(500).json({ msg: 'Server error retrieving states' });
    }
});

router.post('/states', [auth, superAdminAuth], async (req, res) => {
    try {
        const { name, code, stateId, status = 'Active', description = '', logo = '', notes = '' } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ msg: 'State Name is required' });
        }
        if (!code || !code.trim()) {
            return res.status(400).json({ msg: 'State Code is required' });
        }

        const trimmedName = name.trim();
        const trimmedCode = code.trim().toUpperCase();
        const finalStateId = (stateId && stateId.trim()) ? stateId.trim().toUpperCase() : `ST-${trimmedCode}`;

        // Check for uniqueness
        const existing = await State.findOne({
            $or: [
                { name: new RegExp(`^${trimmedName}$`, 'i') },
                { code: trimmedCode },
                { stateId: finalStateId }
            ]
        });

        if (existing) {
            return res.status(400).json({ msg: `State with name "${trimmedName}", code "${trimmedCode}", or ID already exists` });
        }

        const newState = new State({
            stateId: finalStateId,
            name: trimmedName,
            code: trimmedCode,
            status,
            description,
            logo,
            notes,
            createdBy: req.adminUser._id,
            updatedBy: req.adminUser._id
        });

        await newState.save();
        await logAudit(req, 'State Created', 'State', newState.stateId, newState.name, null, newState.toObject());

        res.status(201).json({ success: true, data: newState });
    } catch (err) {
        console.error('Create State Error:', err);
        res.status(500).json({ msg: err.message || 'Server error creating state' });
    }
});

router.put('/states/:id', [auth, superAdminAuth], async (req, res) => {
    try {
        const { name, code, status, description, logo, notes } = req.body;
        const state = await State.findById(req.params.id);
        if (!state) return res.status(404).json({ msg: 'State not found' });

        const prev = state.toObject();

        if (name && name.trim()) state.name = name.trim();
        if (code && code.trim()) state.code = code.trim().toUpperCase();
        if (status) state.status = status;
        if (description !== undefined) state.description = description;
        if (logo !== undefined) state.logo = logo;
        if (notes !== undefined) state.notes = notes;
        state.updatedBy = req.adminUser._id;

        await state.save();
        await logAudit(req, 'State Updated', 'State', state.stateId, state.name, prev, state.toObject());

        res.json({ success: true, data: state });
    } catch (err) {
        console.error('Update State Error:', err);
        res.status(500).json({ msg: err.message || 'Server error updating state' });
    }
});

router.patch('/states/:id/status', [auth, superAdminAuth], async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Active', 'Inactive'].includes(status)) {
            return res.status(400).json({ msg: 'Invalid status. Must be Active or Inactive' });
        }

        const state = await State.findById(req.params.id);
        if (!state) return res.status(404).json({ msg: 'State not found' });

        const prevStatus = state.status;
        state.status = status;
        state.updatedBy = req.adminUser._id;
        await state.save();

        await logAudit(req, `Territory ${status === 'Active' ? 'Reactivated' : 'Deactivated'}`, 'State', state.stateId, state.name, { status: prevStatus }, { status });

        res.json({ success: true, data: state });
    } catch (err) {
        res.status(500).json({ msg: 'Server error updating status' });
    }
});

router.delete('/states/:id', [auth, superAdminAuth], async (req, res) => {
    // Requirement 8: State deletion/removal must NOT be allowed.
    return res.status(403).json({
        success: false,
        msg: 'State deletion is not allowed. States are protected top-level geographic entities.'
    });
});

// ============================================================
// 4. DISTRICT CRUD
// ============================================================
router.get('/districts', [optionalAuth], async (req, res) => {
    try {
        const filter = {};
        if (req.query.status && req.query.status.toLowerCase() !== 'all') {
            filter.status = req.query.status;
        } else if (!req.query.status) {
            filter.status = 'Active'; // Requirement 12: default to Active
        }

        const scope = getTerritoryScope(req.user);
        let targetStateId = req.query.stateId;

        if (scope && !scope.isSuperAdmin) {
            if (scope.district) {
                filter.$or = [
                    { name: new RegExp('^' + scope.district + '$', 'i') },
                    { code: scope.district.toUpperCase() }
                ];
            } else if (scope.state && !targetStateId && !req.query.state) {
                const stateDoc = await State.findOne({
                    $or: [
                        { name: new RegExp('^' + scope.state + '$', 'i') },
                        { code: scope.state.toUpperCase() }
                    ]
                }).select('_id');
                if (stateDoc) {
                    targetStateId = stateDoc._id;
                } else {
                    return res.json([]);
                }
            }
        }

        // Support state name / code filter query (e.g. from Manager or Admin modules)
        if (!targetStateId && req.query.state) {
            const trimmedState = req.query.state.trim();
            const stateDoc = await State.findOne({
                $or: [
                    { name: new RegExp('^' + trimmedState + '$', 'i') },
                    { code: trimmedState.toUpperCase() }
                ]
            }).select('_id');
            if (stateDoc) {
                targetStateId = stateDoc._id;
            } else {
                return res.json([]);
            }
        }

        if (targetStateId) {
            filter.stateId = targetStateId;
        }

        const districts = await District.find(filter).populate('stateId', 'name code').sort({ name: 1 });
        res.json(districts);
    } catch (err) {
        res.status(500).json({ msg: 'Server error retrieving districts' });
    }
});

router.post('/districts', [auth, superAdminAuth], async (req, res) => {
    try {
        const { stateId, name, code, districtId, status = 'Active', headquarters = '', description = '', notes = '' } = req.body;

        if (!stateId) {
            return res.status(400).json({ msg: 'Parent State selection is required' });
        }
        if (!name || !name.trim()) {
            return res.status(400).json({ msg: 'District Name is required' });
        }
        if (!code || !code.trim()) {
            return res.status(400).json({ msg: 'District Code is required' });
        }

        // Verify parent state exists
        const state = await State.findById(stateId);
        if (!state) {
            return res.status(400).json({ msg: 'Parent State does not exist' });
        }

        const trimmedName = name.trim();
        const trimmedCode = code.trim().toUpperCase();
        const finalDistId = (districtId && districtId.trim()) ? districtId.trim().toUpperCase() : `DIST-${state.code}-${trimmedCode}`;

        // Check uniqueness within the state
        const existing = await District.findOne({
            stateId,
            name: new RegExp(`^${trimmedName}$`, 'i')
        });
        if (existing) {
            return res.status(400).json({ msg: `District "${trimmedName}" already exists in ${state.name}` });
        }

        const newDistrict = new District({
            districtId: finalDistId,
            stateId,
            name: trimmedName,
            code: trimmedCode,
            status,
            headquarters,
            description,
            notes,
            createdBy: req.adminUser._id,
            updatedBy: req.adminUser._id
        });

        await newDistrict.save();
        await logAudit(req, 'District Created', 'District', newDistrict.districtId, newDistrict.name, null, newDistrict.toObject());

        res.status(201).json({ success: true, data: newDistrict });
    } catch (err) {
        console.error('Create District Error:', err);
        res.status(500).json({ msg: err.message || 'Server error creating district' });
    }
});

router.put('/districts/:id', [auth, superAdminAuth], async (req, res) => {
    try {
        const { name, code, status, headquarters, description, notes } = req.body;
        const district = await District.findById(req.params.id);
        if (!district) return res.status(404).json({ msg: 'District not found' });

        const prev = district.toObject();
        if (name && name.trim()) district.name = name.trim();
        if (code && code.trim()) district.code = code.trim().toUpperCase();
        if (status) district.status = status;
        if (headquarters !== undefined) district.headquarters = headquarters;
        if (description !== undefined) district.description = description;
        if (notes !== undefined) district.notes = notes;
        district.updatedBy = req.adminUser._id;

        await district.save();
        await logAudit(req, 'District Updated', 'District', district.districtId, district.name, prev, district.toObject());

        res.json({ success: true, data: district });
    } catch (err) {
        res.status(500).json({ msg: err.message || 'Server error updating district' });
    }
});

router.patch('/districts/:id/status', [auth, superAdminAuth], async (req, res) => {
    try {
        const { status } = req.body;
        const district = await District.findById(req.params.id);
        if (!district) return res.status(404).json({ msg: 'District not found' });

        const prevStatus = district.status;
        district.status = status;
        district.updatedBy = req.adminUser._id;
        await district.save();

        await logAudit(req, `Territory ${status === 'Active' ? 'Reactivated' : 'Deactivated'}`, 'District', district.districtId, district.name, { status: prevStatus }, { status });

        res.json({ success: true, data: district });
    } catch (err) {
        res.status(500).json({ msg: 'Server error updating status' });
    }
});

router.delete('/districts/:id', [auth, superAdminAuth], async (req, res) => {
    try {
        const district = await District.findById(req.params.id);
        if (!district) return res.status(404).json({ success: false, msg: 'District not found' });

        // Safe delete validation: check for existing child divisions, pincodes, assigned agents/managers/vendors
        const [
            childDivisionsCount,
            childPincodesCount,
            assignedAgentsCount,
            assignedManagersCount,
            assignedVendorsCount
        ] = await Promise.all([
            Division.countDocuments({ districtId: district._id }),
            Pincode.countDocuments({ $or: [{ districtId: district._id }, { district: district.name }] }),
            User.countDocuments({ role: 'agent', assignedDistrict: { $in: [district.name, district.code] } }),
            User.countDocuments({ role: { $in: ['admin', 'manager', 'sub-admin'] }, assignedDistrict: { $in: [district.name, district.code] } }),
            Vendor.countDocuments({ district: { $regex: new RegExp(`^${district.name}$`, 'i') } })
        ]);

        const dependencies = [];
        if (childDivisionsCount > 0) dependencies.push(`${childDivisionsCount} Division${childDivisionsCount > 1 ? 's' : ''}`);
        if (childPincodesCount > 0) dependencies.push(`${childPincodesCount} Pincode${childPincodesCount > 1 ? 's' : ''}`);
        if (assignedAgentsCount > 0) dependencies.push(`${assignedAgentsCount} Agent${assignedAgentsCount > 1 ? 's' : ''}`);
        if (assignedManagersCount > 0) dependencies.push(`${assignedManagersCount} Manager${assignedManagersCount > 1 ? 's' : ''}`);
        if (assignedVendorsCount > 0) dependencies.push(`${assignedVendorsCount} Vendor${assignedVendorsCount > 1 ? 's' : ''}`);

        if (dependencies.length > 0) {
            return res.status(400).json({
                success: false,
                msg: `This district contains associated ${dependencies.join(', ')}. Please remove or reassign dependent records before deleting.`
            });
        }

        await District.findByIdAndDelete(req.params.id);
        await logAudit(req, 'Territory Deleted', 'District', district.districtId, district.name, district.toObject(), null);

        res.json({ success: true, msg: `District "${district.name}" deleted successfully` });
    } catch (err) {
        console.error('Delete District Error:', err);
        res.status(500).json({ success: false, msg: 'Server error deleting district' });
    }
});

// ============================================================
// 5. DIVISION CRUD (Fully manual entry supported)
// ============================================================
router.get('/divisions', [optionalAuth], async (req, res) => {
    try {
        const filter = {};
        if (req.query.status && req.query.status.toLowerCase() !== 'all') {
            filter.status = req.query.status;
        } else if (!req.query.status) {
            filter.status = 'Active'; // Requirement 12: default to Active
        }

        const scope = getTerritoryScope(req.user);
        let targetDistrictId = req.query.districtId;
        let targetStateId = req.query.stateId;

        if (scope && !scope.isSuperAdmin) {
            if (scope.division) {
                filter.name = new RegExp('^' + scope.division + '$', 'i');
            } else if (scope.district && !targetDistrictId && !req.query.district) {
                const distDoc = await District.findOne({
                    $or: [
                        { name: new RegExp('^' + scope.district + '$', 'i') },
                        { code: scope.district.toUpperCase() }
                    ]
                }).select('_id stateId');
                if (distDoc) {
                    targetDistrictId = distDoc._id;
                } else {
                    return res.json([]);
                }
            } else if (scope.state && !targetStateId && !req.query.state) {
                const stateDoc = await State.findOne({
                    $or: [
                        { name: new RegExp('^' + scope.state + '$', 'i') },
                        { code: scope.state.toUpperCase() }
                    ]
                }).select('_id');
                if (stateDoc) {
                    targetStateId = stateDoc._id;
                }
            }
        }

        // Support district name / code query
        if (!targetDistrictId && req.query.district) {
            const trimmedDistrict = req.query.district.trim();
            const distDoc = await District.findOne({
                $or: [
                    { name: new RegExp('^' + trimmedDistrict + '$', 'i') },
                    { code: trimmedDistrict.toUpperCase() }
                ]
            }).select('_id stateId');
            if (distDoc) {
                targetDistrictId = distDoc._id;
            } else {
                return res.json([]);
            }
        }

        if (!targetStateId && req.query.state) {
            const trimmedState = req.query.state.trim();
            const stateDoc = await State.findOne({
                $or: [
                    { name: new RegExp('^' + trimmedState + '$', 'i') },
                    { code: trimmedState.toUpperCase() }
                ]
            }).select('_id');
            if (stateDoc) {
                targetStateId = stateDoc._id;
            } else {
                return res.json([]);
            }
        }

        if (targetDistrictId) filter.districtId = targetDistrictId;
        if (targetStateId) filter.stateId = targetStateId;

        const divisions = await Division.find(filter)
            .populate('stateId', 'name code')
            .populate('districtId', 'name code')
            .sort({ name: 1 });
        res.json(divisions);
    } catch (err) {
        res.status(500).json({ msg: 'Server error retrieving divisions' });
    }
});

router.post('/divisions', [auth, superAdminAuth], async (req, res) => {
    try {
        const { districtId, stateId, name, code, divisionId, divisionType = 'Administrative', status = 'Active', talukInfo = '', description = '', notes = '' } = req.body;

        if (!districtId) {
            return res.status(400).json({ msg: 'Parent District selection is required' });
        }
        if (!name || !name.trim()) {
            return res.status(400).json({ msg: 'Division Name is required' });
        }

        const district = await District.findById(districtId);
        if (!district) {
            return res.status(400).json({ msg: 'Parent District does not exist' });
        }

        const finalStateId = stateId || district.stateId;
        const trimmedName = name.trim();
        const trimmedCode = (code && code.trim()) ? code.trim().toUpperCase() : trimmedName.substring(0, 4).toUpperCase();
        const finalDivId = (divisionId && divisionId.trim()) ? divisionId.trim().toUpperCase() : `DIV-${district.code}-${trimmedCode}`;

        // Check uniqueness within the district
        const existing = await Division.findOne({
            districtId,
            name: new RegExp(`^${trimmedName}$`, 'i')
        });
        if (existing) {
            return res.status(400).json({ msg: `Division "${trimmedName}" already exists in ${district.name}` });
        }

        const newDivision = new Division({
            divisionId: finalDivId,
            stateId: finalStateId,
            districtId,
            name: trimmedName,
            code: trimmedCode,
            divisionType,
            status,
            talukInfo,
            description,
            notes,
            createdBy: req.adminUser._id,
            updatedBy: req.adminUser._id
        });

        await newDivision.save();
        await logAudit(req, 'Division Created', 'Division', newDivision.divisionId, newDivision.name, null, newDivision.toObject());

        res.status(201).json({ success: true, data: newDivision });
    } catch (err) {
        console.error('Create Division Error:', err);
        res.status(500).json({ msg: err.message || 'Server error creating division' });
    }
});

router.put('/divisions/:id', [auth, superAdminAuth], async (req, res) => {
    try {
        const { name, code, divisionType, status, talukInfo, description, notes } = req.body;
        const division = await Division.findById(req.params.id);
        if (!division) return res.status(404).json({ msg: 'Division not found' });

        const prev = division.toObject();
        if (name && name.trim()) division.name = name.trim();
        if (code && code.trim()) division.code = code.trim().toUpperCase();
        if (divisionType) division.divisionType = divisionType;
        if (status) division.status = status;
        if (talukInfo !== undefined) division.talukInfo = talukInfo;
        if (description !== undefined) division.description = description;
        if (notes !== undefined) division.notes = notes;
        division.updatedBy = req.adminUser._id;

        await division.save();
        await logAudit(req, 'Division Updated', 'Division', division.divisionId, division.name, prev, division.toObject());

        res.json({ success: true, data: division });
    } catch (err) {
        res.status(500).json({ msg: err.message || 'Server error updating division' });
    }
});

router.patch('/divisions/:id/status', [auth, superAdminAuth], async (req, res) => {
    try {
        const { status } = req.body;
        const division = await Division.findById(req.params.id);
        if (!division) return res.status(404).json({ msg: 'Division not found' });

        const prevStatus = division.status;
        division.status = status;
        division.updatedBy = req.adminUser._id;
        await division.save();

        await logAudit(req, `Territory ${status === 'Active' ? 'Reactivated' : 'Deactivated'}`, 'Division', division.divisionId, division.name, { status: prevStatus }, { status });

        res.json({ success: true, data: division });
    } catch (err) {
        res.status(500).json({ msg: 'Server error updating status' });
    }
});

router.delete('/divisions/:id', [auth, superAdminAuth], async (req, res) => {
    try {
        const division = await Division.findById(req.params.id);
        if (!division) return res.status(404).json({ success: false, msg: 'Division not found' });

        // Safe delete validation: check for child pincodes and assigned agents/managers
        const [
            childPincodesCount,
            assignedAgentsCount,
            assignedManagersCount
        ] = await Promise.all([
            Pincode.countDocuments({ $or: [{ divisionId: division._id }, { division: division.name }] }),
            User.countDocuments({
                role: 'agent',
                $or: [
                    { assignedArea: { $regex: new RegExp(division.name, 'i') } },
                    { assignedDistrict: division.name }
                ]
            }),
            User.countDocuments({
                role: { $in: ['admin', 'manager', 'sub-admin'] },
                $or: [
                    { assignedArea: { $regex: new RegExp(division.name, 'i') } },
                    { assignedDistrict: division.name }
                ]
            })
        ]);

        const dependencies = [];
        if (childPincodesCount > 0) dependencies.push(`${childPincodesCount} Pincode${childPincodesCount > 1 ? 's' : ''}`);
        if (assignedAgentsCount > 0) dependencies.push(`${assignedAgentsCount} Agent${assignedAgentsCount > 1 ? 's' : ''}`);
        if (assignedManagersCount > 0) dependencies.push(`${assignedManagersCount} Manager${assignedManagersCount > 1 ? 's' : ''}`);

        if (dependencies.length > 0) {
            return res.status(400).json({
                success: false,
                msg: `This division contains associated ${dependencies.join(', ')}. Please remove or reassign dependent records before deleting.`
            });
        }

        await Division.findByIdAndDelete(req.params.id);
        await logAudit(req, 'Territory Deleted', 'Division', division.divisionId, division.name, division.toObject(), null);

        res.json({ success: true, msg: `Division "${division.name}" deleted successfully` });
    } catch (err) {
        console.error('Delete Division Error:', err);
        res.status(500).json({ success: false, msg: 'Server error deleting division' });
    }
});

// ============================================================
// 6. PINCODE CRUD
// ============================================================
router.get('/pincodes', [optionalAuth], async (req, res) => {
    try {
        const filter = {};
        if (req.query.status && req.query.status.toLowerCase() !== 'all') {
            filter.status = req.query.status;
        } else if (!req.query.status) {
            filter.status = 'Active'; // Requirement 12: default to Active
        }

        const scope = getTerritoryScope(req.user);
        let targetDivisionId = req.query.divisionId;
        let targetDistrictId = req.query.districtId;
        let targetStateId = req.query.stateId;

        if (scope && !scope.isSuperAdmin) {
            if (scope.pincode) {
                filter.code = String(scope.pincode).trim();
            } else if (scope.division && !targetDivisionId && !req.query.division) {
                const divDoc = await Division.findOne({
                    $or: [
                        { name: new RegExp('^' + scope.division + '$', 'i') },
                        { code: scope.division.toUpperCase() }
                    ]
                }).select('_id');
                if (divDoc) targetDivisionId = divDoc._id;
            } else if (scope.district && !targetDistrictId && !req.query.district) {
                const distDoc = await District.findOne({
                    $or: [
                        { name: new RegExp('^' + scope.district + '$', 'i') },
                        { code: scope.district.toUpperCase() }
                    ]
                }).select('_id');
                if (distDoc) targetDistrictId = distDoc._id;
            } else if (scope.state && !targetStateId && !req.query.state) {
                const stateDoc = await State.findOne({
                    $or: [
                        { name: new RegExp('^' + scope.state + '$', 'i') },
                        { code: scope.state.toUpperCase() }
                    ]
                }).select('_id');
                if (stateDoc) targetStateId = stateDoc._id;
            }
        }

        if (!targetDivisionId && req.query.division) {
            const trimmedDiv = req.query.division.trim();
            const divDoc = await Division.findOne({
                $or: [
                    { name: new RegExp('^' + trimmedDiv + '$', 'i') },
                    { code: trimmedDiv.toUpperCase() }
                ]
            }).select('_id');
            if (divDoc) {
                targetDivisionId = divDoc._id;
            } else {
                return res.json([]);
            }
        }

        if (!targetDistrictId && req.query.district) {
            const trimmedDistrict = req.query.district.trim();
            const distDoc = await District.findOne({
                $or: [
                    { name: new RegExp('^' + trimmedDistrict + '$', 'i') },
                    { code: trimmedDistrict.toUpperCase() }
                ]
            }).select('_id');
            if (distDoc) {
                targetDistrictId = distDoc._id;
            } else {
                return res.json([]);
            }
        }

        if (!targetStateId && req.query.state) {
            const trimmedState = req.query.state.trim();
            const stateDoc = await State.findOne({
                $or: [
                    { name: new RegExp('^' + trimmedState + '$', 'i') },
                    { code: trimmedState.toUpperCase() }
                ]
            }).select('_id');
            if (stateDoc) {
                targetStateId = stateDoc._id;
            } else {
                return res.json([]);
            }
        }

        if (targetDivisionId) {
            filter.$or = [{ divisionId: targetDivisionId }, { division: req.query.division?.trim() }];
        } else if (targetDistrictId) {
            filter.$or = [{ districtId: targetDistrictId }, { district: req.query.district?.trim() }];
        } else if (targetStateId) {
            filter.$or = [{ stateId: targetStateId }, { state: req.query.state?.trim() }];
        }

        const pincodes = await Pincode.find(filter)
            .populate('stateId', 'name code')
            .populate('districtId', 'name code')
            .populate('divisionId', 'name code')
            .populate('activeAgentId', 'name email phone level')
            .sort({ code: 1 });
        res.json(pincodes);
    } catch (err) {
        res.status(500).json({ msg: 'Server error retrieving pincodes' });
    }
});

router.post('/pincodes', [auth, superAdminAuth], async (req, res) => {
    try {
        const {
            code,
            pincodeId,
            stateId,
            districtId,
            divisionId,
            area = '',
            taluk = '',
            postOffice = '',
            status = 'Active',
            description = '',
            notes = ''
        } = req.body;

        if (!code || !code.trim() || code.trim().length !== 6 || isNaN(code)) {
            return res.status(400).json({ msg: 'Valid 6-digit Pincode is required' });
        }

        const trimmedCode = code.trim();

        // Check if code already exists
        const existingPin = await Pincode.findOne({ code: trimmedCode });
        if (existingPin) {
            return res.status(400).json({ msg: `Pincode ${trimmedCode} is already registered in the system` });
        }

        let stateObj = null;
        let distObj = null;
        let divObj = null;

        if (divisionId) {
            divObj = await Division.findById(divisionId).populate('districtId').populate('stateId');
            if (divObj) {
                distObj = divObj.districtId;
                stateObj = divObj.stateId;
            }
        }
        if (!distObj && districtId) {
            distObj = await District.findById(districtId).populate('stateId');
            if (distObj) stateObj = distObj.stateId;
        }
        if (!stateObj && stateId) {
            stateObj = await State.findById(stateId);
        }

        const newPincode = new Pincode({
            code: trimmedCode,
            pincodeId: (pincodeId && pincodeId.trim()) ? pincodeId.trim().toUpperCase() : `PIN-${trimmedCode}`,
            name: postOffice.trim() || area.trim() || `Postal Zone ${trimmedCode}`,
            postOffice: postOffice.trim(),
            taluk: taluk.trim(),
            area: area.trim(),
            district: distObj ? distObj.name : (req.body.district || 'General'),
            state: stateObj ? stateObj.name : (req.body.state || 'General'),
            division: divObj ? divObj.name : (req.body.division || 'General'),
            stateId: stateObj ? stateObj._id : null,
            districtId: distObj ? distObj._id : null,
            divisionId: divObj ? divObj._id : null,
            status,
            description,
            notes
        });

        await newPincode.save();
        await logAudit(req, 'Pincode Created', 'Pincode', newPincode.pincodeId, newPincode.code, null, newPincode.toObject());

        res.status(201).json({ success: true, data: newPincode });
    } catch (err) {
        console.error('Create Pincode Error:', err);
        res.status(500).json({ msg: err.message || 'Server error creating pincode' });
    }
});

router.put('/pincodes/:id', [auth, superAdminAuth], async (req, res) => {
    try {
        const { taluk, area, postOffice, status, description, notes, divisionId } = req.body;
        const pin = await Pincode.findById(req.params.id);
        if (!pin) return res.status(404).json({ msg: 'Pincode not found' });

        const prev = pin.toObject();

        if (taluk !== undefined) pin.taluk = taluk;
        if (area !== undefined) pin.area = area;
        if (postOffice !== undefined) {
            pin.postOffice = postOffice;
            pin.name = postOffice || pin.name;
        }
        if (status) pin.status = status;
        if (description !== undefined) pin.description = description;
        if (notes !== undefined) pin.notes = notes;

        if (divisionId && divisionId !== String(pin.divisionId)) {
            const divObj = await Division.findById(divisionId).populate('districtId').populate('stateId');
            if (divObj) {
                pin.divisionId = divObj._id;
                pin.division = divObj.name;
                if (divObj.districtId) {
                    pin.districtId = divObj.districtId._id;
                    pin.district = divObj.districtId.name;
                }
                if (divObj.stateId) {
                    pin.stateId = divObj.stateId._id;
                    pin.state = divObj.stateId.name;
                }
            }
        }

        await pin.save();
        await logAudit(req, 'Pincode Updated', 'Pincode', pin.pincodeId || pin.code, pin.code, prev, pin.toObject());

        res.json({ success: true, data: pin });
    } catch (err) {
        res.status(500).json({ msg: err.message || 'Server error updating pincode' });
    }
});

router.patch('/pincodes/:id/status', [auth, superAdminAuth], async (req, res) => {
    try {
        const { status } = req.body;
        const pin = await Pincode.findById(req.params.id);
        if (!pin) return res.status(404).json({ msg: 'Pincode not found' });

        const prevStatus = pin.status;
        pin.status = status;
        await pin.save();

        await logAudit(req, `Territory ${status === 'Active' ? 'Reactivated' : 'Deactivated'}`, 'Pincode', pin.pincodeId || pin.code, pin.code, { status: prevStatus }, { status });

        res.json({ success: true, data: pin });
    } catch (err) {
        res.status(500).json({ msg: 'Server error updating status' });
    }
});

router.delete('/pincodes/:id', [auth, superAdminAuth], async (req, res) => {
    try {
        const pin = await Pincode.findById(req.params.id);
        if (!pin) return res.status(404).json({ success: false, msg: 'Pincode not found' });

        // Safe delete validation: check whether assigned to any agent, manager, or vendor territory
        const [assignedAgent, assignedManager, assignedVendor] = await Promise.all([
            User.findOne({
                role: 'agent',
                $or: [
                    { assignedPincode: pin.code },
                    { _id: pin.activeAgentId }
                ]
            }).select('name email phone'),
            User.findOne({
                role: { $in: ['admin', 'manager', 'sub-admin'] },
                assignedPincode: pin.code
            }).select('name email'),
            Vendor.findOne({ pincode: pin.code }).select('name businessName')
        ]);

        const dependencies = [];
        if (assignedAgent) dependencies.push(`Agent: ${assignedAgent.name}`);
        if (assignedManager) dependencies.push(`Manager: ${assignedManager.name}`);
        if (assignedVendor) dependencies.push(`Vendor: ${assignedVendor.businessName || assignedVendor.name}`);

        if (dependencies.length > 0) {
            return res.status(400).json({
                success: false,
                msg: `Cannot delete Pincode "${pin.code}". It is currently assigned to ${dependencies.join(', ')}. Please reassign or unassign before deleting.`
            });
        }

        await Pincode.findByIdAndDelete(req.params.id);
        await logAudit(req, 'Territory Deleted', 'Pincode', pin.pincodeId || pin.code, pin.code, pin.toObject(), null);

        res.json({ success: true, msg: `Pincode ${pin.code} deleted successfully` });
    } catch (err) {
        console.error('Delete Pincode Error:', err);
        res.status(500).json({ success: false, msg: 'Server error deleting pincode' });
    }
});

// ============================================================
// 7. AUDIT LOGS
// ============================================================
// ============================================================
// 8. CENTRALIZED TERRITORY HIERARCHY VALIDATION & LOOKUP
// ============================================================

/**
 * Strict Hierarchy Validator
 * Validates that:
 * 1. State exists and is Active
 * 2. District exists, is Active, and belongs to State
 * 3. Division exists, is Active, and belongs to District
 * 4. Pincode exists, is Active, and belongs to Division/District/State
 */
const validateTerritoryHierarchy = async ({ state, district, division, pincode, requireActive = true }) => {
    let stateDoc = null;
    let distDoc = null;
    let divDoc = null;
    let pinDoc = null;

    const statusFilter = requireActive ? { status: 'Active' } : {};

    // 1. Validate State (if provided)
    if (state) {
        const stStr = String(state).trim();
        const isOid = mongoose.Types.ObjectId.isValid(stStr);
        stateDoc = await State.findOne({
            $and: [
                statusFilter,
                {
                    $or: [
                        ...(isOid ? [{ _id: new mongoose.Types.ObjectId(stStr) }] : []),
                        { name: new RegExp(`^${stStr}$`, 'i') },
                        { code: stStr.toUpperCase() }
                    ]
                }
            ]
        });

        if (!stateDoc) {
            return {
                valid: false,
                message: `Territory validation failure: State "${stStr}" does not exist in the database or is inactive.`
            };
        }
    }

    // 2. Validate District (if provided)
    if (district) {
        const distStr = String(district).trim();
        const isDistOid = mongoose.Types.ObjectId.isValid(distStr);

        const distQuery = {
            $and: [
                statusFilter,
                {
                    $or: [
                        ...(isDistOid ? [{ _id: new mongoose.Types.ObjectId(distStr) }] : []),
                        { name: new RegExp(`^${distStr}$`, 'i') },
                        { code: distStr.toUpperCase() }
                    ]
                }
            ]
        };

        if (stateDoc) {
            distQuery.stateId = stateDoc._id;
        }

        distDoc = await District.findOne(distQuery);

        if (!distDoc) {
            const stateContext = stateDoc ? ` belonging to State "${stateDoc.name}"` : '';
            return {
                valid: false,
                message: `Territory validation failure: District "${distStr}" does not exist${stateContext} or is inactive.`
            };
        }

        if (!stateDoc && distDoc.stateId) {
            stateDoc = await State.findOne({ _id: distDoc.stateId, ...statusFilter });
        }
    }

    // 3. Validate Division (if provided)
    if (division) {
        const divStr = String(division).trim();
        const isDivOid = mongoose.Types.ObjectId.isValid(divStr);

        const divQuery = {
            $and: [
                statusFilter,
                {
                    $or: [
                        ...(isDivOid ? [{ _id: new mongoose.Types.ObjectId(divStr) }] : []),
                        { name: new RegExp(`^${divStr}$`, 'i') },
                        { code: divStr.toUpperCase() }
                    ]
                }
            ]
        };

        if (distDoc) {
            divQuery.districtId = distDoc._id;
        } else if (stateDoc) {
            divQuery.stateId = stateDoc._id;
        }

        divDoc = await Division.findOne(divQuery);

        if (!divDoc) {
            const distContext = distDoc ? ` belonging to District "${distDoc.name}"` : '';
            return {
                valid: false,
                message: `Territory validation failure: Division "${divStr}" does not exist${distContext} or is inactive.`
            };
        }

        if (!distDoc && divDoc.districtId) {
            distDoc = await District.findOne({ _id: divDoc.districtId, ...statusFilter });
        }
        if (!stateDoc && divDoc.stateId) {
            stateDoc = await State.findOne({ _id: divDoc.stateId, ...statusFilter });
        }
    }

    // 4. Validate Pincode (if provided)
    if (pincode) {
        const pinStr = String(pincode).trim();
        const pinQuery = {
            code: pinStr,
            ...statusFilter
        };

        pinDoc = await Pincode.findOne(pinQuery);

        if (!pinDoc) {
            return {
                valid: false,
                message: `Territory validation failure: Pincode "${pinStr}" is not registered in the database or is inactive.`
            };
        }

        // Verify Pincode belongs to specified Division
        if (divDoc) {
            const divMatch = (pinDoc.divisionId && pinDoc.divisionId.equals(divDoc._id)) ||
                (pinDoc.division && pinDoc.division.toLowerCase() === divDoc.name.toLowerCase());
            if (!divMatch) {
                return {
                    valid: false,
                    message: `Territory validation failure: Pincode "${pinStr}" does not belong to Division "${divDoc.name}".`
                };
            }
        }

        // Verify Pincode belongs to specified District
        if (distDoc) {
            const distMatch = (pinDoc.districtId && pinDoc.districtId.equals(distDoc._id)) ||
                (pinDoc.district && pinDoc.district.toLowerCase() === distDoc.name.toLowerCase());
            if (!distMatch) {
                return {
                    valid: false,
                    message: `Territory validation failure: Pincode "${pinStr}" does not belong to District "${distDoc.name}".`
                };
            }
        }

        // Verify Pincode belongs to specified State
        if (stateDoc) {
            const stateMatch = (pinDoc.stateId && pinDoc.stateId.equals(stateDoc._id)) ||
                (pinDoc.state && pinDoc.state.toLowerCase() === stateDoc.name.toLowerCase());
            if (!stateMatch) {
                return {
                    valid: false,
                    message: `Territory validation failure: Pincode "${pinStr}" does not belong to State "${stateDoc.name}".`
                };
            }
        }
    }

    return {
        valid: true,
        data: {
            state: stateDoc ? { _id: stateDoc._id, name: stateDoc.name, code: stateDoc.code } : null,
            district: distDoc ? { _id: distDoc._id, name: distDoc.name, code: distDoc.code } : null,
            division: divDoc ? { _id: divDoc._id, name: divDoc.name, code: divDoc.code } : null,
            pincode: pinDoc ? { _id: pinDoc._id, code: pinDoc.code, name: pinDoc.name } : null
        }
    };
};

// Lookup Pincode details from central database
router.get('/lookup/:code', [optionalAuth], async (req, res) => {
    try {
        const { code } = req.params;
        const pin = await Pincode.findOne({ code: String(code).trim() })
            .populate('stateId', 'name code status')
            .populate('districtId', 'name code status')
            .populate('divisionId', 'name code status')
            .lean();

        if (!pin) {
            return res.status(404).json({ success: false, message: `Pincode ${code} not found in database.` });
        }

        res.json({
            success: true,
            data: {
                pincode: pin.code,
                name: pin.name,
                state: pin.stateId?.name || pin.state,
                stateCode: pin.stateId?.code || '',
                stateId: pin.stateId?._id || null,
                district: pin.districtId?.name || pin.district,
                districtCode: pin.districtId?.code || '',
                districtId: pin.districtId?._id || null,
                division: pin.divisionId?.name || pin.division,
                divisionCode: pin.divisionId?.code || '',
                divisionId: pin.divisionId?._id || null,
                status: pin.status
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error looking up pincode' });
    }
});

// Validate Territory Hierarchy Endpoint
router.post('/validate', [optionalAuth], async (req, res) => {
    try {
        const { state, district, division, pincode } = req.body;
        const result = await validateTerritoryHierarchy({ state, district, division, pincode });
        if (!result.valid) {
            return res.status(400).json({ success: false, message: result.message });
        }
        res.json({ success: true, data: result.data });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error validating territory' });
    }
});

router.validateTerritoryHierarchy = validateTerritoryHierarchy;

module.exports = router;
