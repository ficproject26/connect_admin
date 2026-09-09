const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const State = require('../models/State');
const District = require('../models/District');
const Division = require('../models/Division');
const Pincode = require('../models/Pincode');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const TerritoryAuditLog = require('../models/TerritoryAuditLog');

// Super admin authentication middleware
const superAdminAuth = async (req, res, next) => {
    try {
        let userId = req.user.id;
        if (mongoose.Types.ObjectId.isValid(userId)) {
            userId = new mongoose.Types.ObjectId(userId);
        }
        const user = await User.findById(userId).select('role adminRole level status isActive email name').lean();
        const roleVal = (user?.role || '').toLowerCase().trim();
        const adminRoleVal = (user?.adminRole || '').toLowerCase().trim();
        const isSuperAdmin = roleVal === 'super-admin' || adminRoleVal === 'super-admin';

        if (!user || !isSuperAdmin) {
            return res.status(403).json({ msg: 'Access denied. Super Admin territory modification privilege required.' });
        }
        req.adminUser = user;
        next();
    } catch (err) {
        console.error('SuperAdmin middleware error:', err);
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
router.get('/hierarchy', [auth], async (req, res) => {
    try {
        await autoSyncExistingPincodes();

        // Fetch all states, districts, divisions, and pincodes
        const [states, districts, divisions, pincodes, agents, vendors] = await Promise.all([
            State.find().sort({ name: 1 }).lean(),
            District.find().sort({ name: 1 }).lean(),
            Division.find().sort({ name: 1 }).lean(),
            Pincode.find().populate('activeAgentId', 'name email phone level').sort({ code: 1 }).lean(),
            User.find({ role: 'agent', isActive: { $ne: false } }).select('name email phone level assignedState assignedDistrict assignedArea assignedPincode').lean(),
            Vendor.find().select('name businessName state district pincode status').lean()
        ]);

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

        res.json({
            success: true,
            states: Object.values(stateMap),
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
router.get('/stats', [auth], async (req, res) => {
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
router.get('/states', [auth], async (req, res) => {
    try {
        const states = await State.find().sort({ name: 1 });
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
    try {
        const state = await State.findById(req.params.id);
        if (!state) return res.status(404).json({ msg: 'State not found' });

        // Safe delete validation: check for existing child districts
        const childDistrictsCount = await District.countDocuments({ stateId: state._id });
        if (childDistrictsCount > 0) {
            return res.status(400).json({
                msg: `This State contains ${childDistrictsCount} existing Districts. Please remove or reassign its child territories before deleting.`
            });
        }

        await State.findByIdAndDelete(req.params.id);
        await logAudit(req, 'Territory Deleted', 'State', state.stateId, state.name, state.toObject(), null);

        res.json({ success: true, msg: `State "${state.name}" deleted successfully` });
    } catch (err) {
        res.status(500).json({ msg: 'Server error deleting state' });
    }
});

// ============================================================
// 4. DISTRICT CRUD
// ============================================================
router.get('/districts', [auth], async (req, res) => {
    try {
        const filter = {};
        if (req.query.stateId) {
            filter.stateId = req.query.stateId;
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
        if (!district) return res.status(404).json({ msg: 'District not found' });

        // Safe delete validation: check for existing child divisions
        const childDivisionsCount = await Division.countDocuments({ districtId: district._id });
        if (childDivisionsCount > 0) {
            return res.status(400).json({
                msg: `This District contains ${childDivisionsCount} existing Divisions. Please remove or reassign its child territories before deleting.`
            });
        }

        await District.findByIdAndDelete(req.params.id);
        await logAudit(req, 'Territory Deleted', 'District', district.districtId, district.name, district.toObject(), null);

        res.json({ success: true, msg: `District "${district.name}" deleted successfully` });
    } catch (err) {
        res.status(500).json({ msg: 'Server error deleting district' });
    }
});

// ============================================================
// 5. DIVISION CRUD (Fully manual entry supported)
// ============================================================
router.get('/divisions', [auth], async (req, res) => {
    try {
        const filter = {};
        if (req.query.districtId) filter.districtId = req.query.districtId;
        if (req.query.stateId) filter.stateId = req.query.stateId;

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
        if (!division) return res.status(404).json({ msg: 'Division not found' });

        // Safe delete validation: check for existing child pincodes
        const childPincodesCount = await Pincode.countDocuments({ divisionId: division._id });
        if (childPincodesCount > 0) {
            return res.status(400).json({
                msg: `This Division contains ${childPincodesCount} existing Pincodes. Please remove or reassign its child territories before deleting.`
            });
        }

        await Division.findByIdAndDelete(req.params.id);
        await logAudit(req, 'Territory Deleted', 'Division', division.divisionId, division.name, division.toObject(), null);

        res.json({ success: true, msg: `Division "${division.name}" deleted successfully` });
    } catch (err) {
        res.status(500).json({ msg: 'Server error deleting division' });
    }
});

// ============================================================
// 6. PINCODE CRUD
// ============================================================
router.get('/pincodes', [auth], async (req, res) => {
    try {
        const filter = {};
        if (req.query.divisionId) filter.divisionId = req.query.divisionId;
        if (req.query.districtId) filter.districtId = req.query.districtId;
        if (req.query.stateId) filter.stateId = req.query.stateId;
        if (req.query.status) filter.status = req.query.status;

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
        if (!pin) return res.status(404).json({ msg: 'Pincode not found' });

        if (pin.activeAgentId) {
            await User.findByIdAndUpdate(pin.activeAgentId, { assignedPincode: null });
        }

        await Pincode.findByIdAndDelete(req.params.id);
        await logAudit(req, 'Territory Deleted', 'Pincode', pin.pincodeId || pin.code, pin.code, pin.toObject(), null);

        res.json({ success: true, msg: `Pincode ${pin.code} deleted successfully` });
    } catch (err) {
        res.status(500).json({ msg: 'Server error deleting pincode' });
    }
});

// ============================================================
// 7. AUDIT LOGS
// ============================================================
router.get('/audit-logs', [auth], async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await TerritoryAuditLog.find()
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ msg: 'Server error fetching audit logs' });
    }
});

module.exports = router;
