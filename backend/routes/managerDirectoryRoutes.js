const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Manager = require('../models/Manager');
const ManagerRequest = require('../models/ManagerRequest');
const Pincode = require('../models/Pincode');
const State = require('../models/State');
const District = require('../models/District');
const Division = require('../models/Division');
const User = require('../models/User');
const { validateTerritoryHierarchy } = require('./territory');

// ============================================================
// MANAGER DIRECTORY ROUTES
// All routes require authentication (Main Admin sees everything)
// ============================================================

// Helper: safe string for regex
const safeRegex = (val) => new RegExp(`^${val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

// ============================================================
// 1. SUMMARY KPI COUNTS
// GET /manager-directory/summary
// ============================================================
router.get('/manager-directory/summary', auth, async (req, res) => {
    try {
        const [total, active, inactive] = await Promise.all([
            Manager.countDocuments({}),
            Manager.countDocuments({ status: 'Active' }),
            Manager.countDocuments({ status: { $in: ['Inactive', 'Suspended'] } })
        ]);
        const pending = await ManagerRequest.countDocuments({ status: 'Pending' });

        res.json({
            success: true,
            summary: { total, active, pending, inactive }
        });
    } catch (err) {
        console.error('Manager directory summary error:', err);
        res.status(500).json({ msg: 'Error fetching summary', error: err.message });
    }
});

// ============================================================
// 2. GET STATES WITH MANAGER COUNTS
// GET /manager-directory/states
// ============================================================
router.get('/manager-directory/states', auth, async (req, res) => {
    try {
        // Master Database States (Single Source of Truth)
        const dbStates = await State.find({ status: 'Active' }).sort({ name: 1 }).lean();

        // Aggregate managers by state
        const stateCounts = await Manager.aggregate([
            { $group: { _id: '$assignedState', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } } } },
            { $sort: { _id: 1 } }
        ]);

        // Also get states that only have pending requests (no approved managers yet)
        const requestStates = await ManagerRequest.distinct('assignedState', { status: 'Pending' });

        const stateMap = {};
        dbStates.forEach(s => {
            if (s.name) stateMap[s.name] = { state: s.name, code: s.code, totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
        });

        stateCounts.forEach(s => {
            if (s._id) {
                if (!stateMap[s._id]) stateMap[s._id] = { state: s._id, totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
                stateMap[s._id].totalManagers = s.total;
                stateMap[s._id].activeManagers = s.active;
            }
        });
        requestStates.forEach(s => {
            if (s && !stateMap[s]) stateMap[s] = { state: s, totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
        });

        // Add pending request counts
        const pendingCounts = await ManagerRequest.aggregate([
            { $match: { status: 'Pending' } },
            { $group: { _id: '$assignedState', pending: { $sum: 1 } } }
        ]);
        pendingCounts.forEach(p => {
            if (p._id && stateMap[p._id]) stateMap[p._id].pendingRequests = p.pending;
        });

        const states = Object.values(stateMap).sort((a, b) => a.state.localeCompare(b.state));

        res.json({ success: true, states, total: states.length });
    } catch (err) {
        console.error('Manager directory states error:', err);
        res.status(500).json({ msg: 'Error fetching states', error: err.message });
    }
});

// ============================================================
// 3. GET DISTRICTS FOR A STATE WITH MANAGER COUNTS
// GET /manager-directory/states/:state/districts
// ============================================================
router.get('/manager-directory/states/:state/districts', auth, async (req, res) => {
    try {
        const stateName = decodeURIComponent(req.params.state);

        // Find State document in central database
        const stDoc = await State.findOne({
            $or: [
                { name: safeRegex(stateName) },
                { code: stateName.toUpperCase() }
            ]
        });

        const districtMap = {};

        // Populate all Active Districts created in Admin for this State
        if (stDoc) {
            const dbDistricts = await District.find({ stateId: stDoc._id, status: 'Active' }).sort({ name: 1 }).lean();
            dbDistricts.forEach(d => {
                if (d.name) districtMap[d.name] = { district: d.name, state: stDoc.name, totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
            });
        }

        // Get distinct districts from Manager collection + ManagerRequest collection
        const [managerDistricts, requestDistricts] = await Promise.all([
            Manager.aggregate([
                { $match: { assignedState: safeRegex(stateName) } },
                { $group: { _id: '$assignedDistrict', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } } } },
                { $sort: { _id: 1 } }
            ]),
            ManagerRequest.distinct('assignedDistrict', { assignedState: safeRegex(stateName), status: 'Pending' })
        ]);

        managerDistricts.forEach(d => {
            const key = (d._id || '').trim();
            if (key) {
                if (!districtMap[key]) districtMap[key] = { district: key, state: stateName, totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
                districtMap[key].totalManagers = d.total;
                districtMap[key].activeManagers = d.active;
            }
        });
        requestDistricts.forEach(d => {
            const key = (d || '').trim();
            if (key && !districtMap[key]) districtMap[key] = { district: key, state: stateName, totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
        });

        // Add pending counts per district
        const pendingByDistrict = await ManagerRequest.aggregate([
            { $match: { assignedState: safeRegex(stateName), status: 'Pending' } },
            { $group: { _id: '$assignedDistrict', pending: { $sum: 1 } } }
        ]);
        pendingByDistrict.forEach(p => {
            const key = (p._id || '').trim();
            if (key && districtMap[key]) districtMap[key].pendingRequests = p.pending;
        });

        const districts = Object.values(districtMap).sort((a, b) => a.district.localeCompare(b.district));
        res.json({ success: true, state: stateName, districts, total: districts.length });
    } catch (err) {
        console.error('Manager directory districts error:', err);
        res.status(500).json({ msg: 'Error fetching districts', error: err.message });
    }
});

// ============================================================
// 4. GET DIVISIONS FOR A DISTRICT WITH MANAGER COUNTS
// GET /manager-directory/districts/:district/divisions
// ============================================================
router.get('/manager-directory/districts/:district/divisions', auth, async (req, res) => {
    try {
        const districtName = decodeURIComponent(req.params.district);
        const stateName = req.query.state || '';

        const distDoc = await District.findOne({
            name: safeRegex(districtName)
        });

        const divisionMap = {};

        // Master DB Active Divisions
        if (distDoc) {
            const dbDivisions = await Division.find({ districtId: distDoc._id, status: 'Active' }).sort({ name: 1 }).lean();
            dbDivisions.forEach(v => {
                if (v.name) divisionMap[v.name] = { division: v.name, district: distDoc.name, state: stateName || '', totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
            });
        }

        const matchFilter = { assignedDistrict: safeRegex(districtName) };
        if (stateName) matchFilter.assignedState = safeRegex(stateName);

        const [managerDivisions, requestDivisions] = await Promise.all([
            Manager.aggregate([
                { $match: matchFilter },
                { $group: { _id: '$assignedDivision', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } } } },
                { $sort: { _id: 1 } }
            ]),
            ManagerRequest.distinct('assignedDivision', { ...matchFilter, status: 'Pending' })
        ]);

        managerDivisions.forEach(d => {
            const key = (d._id || '').trim();
            if (key) {
                if (!divisionMap[key]) divisionMap[key] = { division: key, district: districtName, state: stateName, totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
                divisionMap[key].totalManagers = d.total;
                divisionMap[key].activeManagers = d.active;
            }
        });
        requestDivisions.forEach(d => {
            const key = (d || '').trim();
            if (key && !divisionMap[key]) divisionMap[key] = { division: key, district: districtName, state: stateName, totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
        });

        // Pending counts per division
        const pendingByDiv = await ManagerRequest.aggregate([
            { $match: { ...matchFilter, status: 'Pending' } },
            { $group: { _id: '$assignedDivision', pending: { $sum: 1 } } }
        ]);
        pendingByDiv.forEach(p => {
            const key = (p._id || '').trim();
            if (key && divisionMap[key]) divisionMap[key].pendingRequests = p.pending;
        });

        const divisions = Object.values(divisionMap).sort((a, b) => a.division.localeCompare(b.division));
        res.json({ success: true, district: districtName, state: stateName, divisions, total: divisions.length });
    } catch (err) {
        console.error('Manager directory divisions error:', err);
        res.status(500).json({ msg: 'Error fetching divisions', error: err.message });
    }
});

// ============================================================
// 5. GET PINCODES FOR A DIVISION WITH MANAGER COUNTS
// GET /manager-directory/divisions/:division/pincodes
// ============================================================
router.get('/manager-directory/divisions/:division/pincodes', auth, async (req, res) => {
    try {
        const divisionName = decodeURIComponent(req.params.division);
        const { state, district } = req.query;

        const divDoc = await Division.findOne({
            name: safeRegex(divisionName)
        });

        const pincodeMap = {};

        // Master DB Active Pincodes
        if (divDoc) {
            const dbPincodes = await Pincode.find({ divisionId: divDoc._id, status: 'Active' }).sort({ code: 1 }).lean();
            dbPincodes.forEach(p => {
                if (p.code) pincodeMap[p.code] = { pincode: p.code, division: divDoc.name, district: district || p.district || '', state: state || p.state || '', totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
            });
        }

        const matchFilter = { assignedDivision: safeRegex(divisionName) };
        if (state) matchFilter.assignedState = safeRegex(state);
        if (district) matchFilter.assignedDistrict = safeRegex(district);

        const [managerPincodes, requestPincodes] = await Promise.all([
            Manager.aggregate([
                { $match: matchFilter },
                { $group: { _id: '$assignedPincode', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } } } },
                { $sort: { _id: 1 } }
            ]),
            ManagerRequest.distinct('assignedPincode', { ...matchFilter, status: 'Pending' })
        ]);

        managerPincodes.forEach(p => {
            const key = (p._id || '').trim();
            if (key) {
                if (!pincodeMap[key]) pincodeMap[key] = { pincode: key, division: divisionName, district: district || '', state: state || '', totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
                pincodeMap[key].totalManagers = p.total;
                pincodeMap[key].activeManagers = p.active;
            }
        });
        requestPincodes.forEach(p => {
            const key = (p || '').trim();
            if (key && !pincodeMap[key]) pincodeMap[key] = { pincode: key, division: divisionName, district: district || '', state: state || '', totalManagers: 0, activeManagers: 0, pendingRequests: 0 };
        });

        const pendingByPin = await ManagerRequest.aggregate([
            { $match: { ...matchFilter, status: 'Pending' } },
            { $group: { _id: '$assignedPincode', pending: { $sum: 1 } } }
        ]);
        pendingByPin.forEach(p => {
            const key = (p._id || '').trim();
            if (key && pincodeMap[key]) pincodeMap[key].pendingRequests = p.pending;
        });

        const pincodes = Object.values(pincodeMap).sort((a, b) => a.pincode.localeCompare(b.pincode));
        res.json({ success: true, division: divisionName, pincodes, total: pincodes.length });
    } catch (err) {
        console.error('Manager directory pincodes error:', err);
        res.status(500).json({ msg: 'Error fetching pincodes', error: err.message });
    }
});

// ============================================================
// 6. GET MANAGERS FOR A PINCODE
// GET /manager-directory/pincodes/:pincode/managers
// ============================================================
router.get('/manager-directory/pincodes/:pincode/managers', auth, async (req, res) => {
    try {
        const pincode = decodeURIComponent(req.params.pincode);
        const { state, district, division } = req.query;

        const matchFilter = { assignedPincode: pincode };
        if (state) matchFilter.assignedState = safeRegex(state);
        if (district) matchFilter.assignedDistrict = safeRegex(district);
        if (division) matchFilter.assignedDivision = safeRegex(division);

        const managers = await Manager.find(matchFilter)
            .populate('parentAdminId', 'name email adminRole adminLevel')
            .populate('approvedBy', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.json({ success: true, pincode, managers, total: managers.length });
    } catch (err) {
        console.error('Manager directory pincode managers error:', err);
        res.status(500).json({ msg: 'Error fetching managers for pincode', error: err.message });
    }
});

// ============================================================
// 7. GET MANAGER DETAILS BY ID
// GET /manager-directory/managers/:id
// ============================================================
router.get('/manager-directory/managers/:id', auth, async (req, res) => {
    try {
        const manager = await Manager.findById(req.params.id)
            .populate('parentAdminId', 'name email adminRole adminLevel assignedState assignedDistrict')
            .populate('approvedBy', 'name email')
            .populate('requestedBy', 'name email adminRole')
            .lean();

        if (!manager) return res.status(404).json({ msg: 'Manager not found' });

        res.json({ success: true, manager });
    } catch (err) {
        console.error('Manager directory get manager error:', err);
        res.status(500).json({ msg: 'Error fetching manager', error: err.message });
    }
});

// ============================================================
// 8. FLAT SEARCH / FILTER ALL MANAGERS (debounced search)
// GET /manager-directory/managers
// ============================================================
router.get('/manager-directory/managers', auth, async (req, res) => {
    try {
        const { search, state, district, division, pincode, level, status, page = 1, limit = 30 } = req.query;

        const query = {};
        if (state && state !== 'All') query.assignedState = safeRegex(state);
        if (district && district !== 'All') query.assignedDistrict = safeRegex(district);
        if (division && division !== 'All') query.assignedDivision = safeRegex(division);
        if (pincode && pincode !== 'All') query.assignedPincode = pincode;
        if (level && level !== 'All') query.level = level.toLowerCase();
        if (status && status !== 'All') query.status = status;

        if (search && search.trim()) {
            const q = search.trim();
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
                { managerId: { $regex: q, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [managers, total] = await Promise.all([
            Manager.find(query)
                .populate('parentAdminId', 'name email adminRole adminLevel')
                .populate('approvedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Manager.countDocuments(query)
        ]);

        res.json({
            success: true,
            managers,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('Manager directory search error:', err);
        res.status(500).json({ msg: 'Error searching managers', error: err.message });
    }
});

// ============================================================
// 9. GET MANAGER REQUESTS
// GET /manager-directory/requests
// ============================================================
router.get('/manager-directory/requests', auth, async (req, res) => {
    try {
        const { status, level, state, district, search, page = 1, limit = 30 } = req.query;

        const query = {};
        if (status && status !== 'All') query.status = status;
        else if (!status) query.status = 'Pending'; // default to Pending

        if (level && level !== 'All') query.level = level.toLowerCase();
        if (state && state !== 'All') query.assignedState = safeRegex(state);
        if (district && district !== 'All') query.assignedDistrict = safeRegex(district);

        if (search && search.trim()) {
            const q = search.trim();
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
                { requestId: { $regex: q, $options: 'i' } },
                { requestingAdminName: { $regex: q, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [requests, total] = await Promise.all([
            ManagerRequest.find(query)
                .populate('requestedBy', 'name email adminRole adminLevel')
                .populate('reviewedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ManagerRequest.countDocuments(query)
        ]);

        res.json({
            success: true,
            requests,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('Manager directory requests error:', err);
        res.status(500).json({ msg: 'Error fetching requests', error: err.message });
    }
});

// ============================================================
// 10. APPROVE MANAGER REQUEST
// PUT /manager-directory/requests/:id/approve
// ============================================================
router.put('/manager-directory/requests/:id/approve', auth, async (req, res) => {
    try {
        const mReq = await ManagerRequest.findById(req.params.id);
        if (!mReq) return res.status(404).json({ msg: 'Manager request not found' });
        if (mReq.status === 'Approved') return res.status(400).json({ msg: 'Request is already approved. Manager record already exists.' });
        if (mReq.status === 'Rejected') return res.status(400).json({ msg: 'Request has been rejected. Cannot approve a rejected request.' });

        // Duplicate check: prevent creating two managers from same request
        const existingManager = await Manager.findOne({ email: mReq.email.toLowerCase().trim() });
        if (existingManager) {
            // Just mark the request approved if manager already exists (idempotent)
            mReq.status = 'Approved';
            mReq.reviewedBy = req.user.id;
            mReq.reviewedAt = new Date();
            await mReq.save();
            return res.json({
                success: true,
                msg: 'Request marked approved (manager record already exists).',
                manager: existingManager,
                request: mReq
            });
        }

        // Check manager limits
        const MANAGER_LIMITS = { state: 8, district: 2, division: 2, pincode: 2 };
        const maxLimit = MANAGER_LIMITS[mReq.level] || 2;
        const countFilter = { level: mReq.level, status: 'Active', assignedState: safeRegex(mReq.assignedState) };
        if (mReq.level === 'district') countFilter.assignedDistrict = safeRegex(mReq.assignedDistrict);
        if (mReq.level === 'division') countFilter.assignedDivision = safeRegex(mReq.assignedDivision);
        if (mReq.level === 'pincode') countFilter.assignedPincode = mReq.assignedPincode;

        const currentCount = await Manager.countDocuments(countFilter);
        if (currentCount >= maxLimit) {
            return res.status(400).json({
                msg: `Cannot approve. Maximum limit of ${maxLimit} managers reached for this ${mReq.level} territory.`
            });
        }

        // Create Manager record
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(1000 + Math.random() * 9000);
        const managerId = `MGR-${mReq.level.slice(0, 3).toUpperCase()}-${dateStr}-${rand}`;

        const newManager = new Manager({
            managerId,
            name: mReq.name,
            email: mReq.email,
            phone: mReq.phone,
            altPhone: mReq.altPhone || '',
            level: mReq.level,
            assignedState: mReq.assignedState,
            assignedDistrict: mReq.assignedDistrict || '',
            assignedDivision: mReq.assignedDivision || '',
            assignedPincode: mReq.assignedPincode || '',
            address: mReq.address || '',
            notes: mReq.notes || '',
            parentAdminId: mReq.requestedBy,
            requestedBy: mReq.requestedBy,
            approvedBy: req.user.id,
            status: 'Active'
        });

        await newManager.save();

        mReq.status = 'Approved';
        mReq.reviewedBy = req.user.id;
        mReq.reviewedAt = new Date();
        await mReq.save();

        res.json({
            success: true,
            msg: `Manager onboarding approved. ${mReq.name} is now an active ${mReq.level} manager.`,
            manager: newManager,
            request: mReq
        });
    } catch (err) {
        console.error('Manager directory approve error:', err);
        res.status(500).json({ msg: 'Error approving request', error: err.message });
    }
});

// ============================================================
// 11. REJECT MANAGER REQUEST
// PUT /manager-directory/requests/:id/reject
// ============================================================
router.put('/manager-directory/requests/:id/reject', auth, async (req, res) => {
    try {
        const mReq = await ManagerRequest.findById(req.params.id);
        if (!mReq) return res.status(404).json({ msg: 'Manager request not found' });
        if (mReq.status === 'Approved') return res.status(400).json({ msg: 'Request is already approved. Cannot reject.' });
        if (mReq.status === 'Rejected') return res.status(400).json({ msg: 'Request is already rejected.' });

        mReq.status = 'Rejected';
        mReq.rejectionReason = (req.body.reason || '').trim() || 'Rejected by Main Admin';
        mReq.reviewedBy = req.user.id;
        mReq.reviewedAt = new Date();
        await mReq.save();

        res.json({ success: true, msg: 'Manager request rejected.', request: mReq });
    } catch (err) {
        console.error('Manager directory reject error:', err);
        res.status(500).json({ msg: 'Error rejecting request', error: err.message });
    }
});

// ============================================================
// 12. UPDATE MANAGER STATUS (activate / suspend)
// PUT /manager-directory/managers/:id/status
// ============================================================
router.put('/manager-directory/managers/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status || !['Active', 'Inactive', 'Suspended'].includes(status)) {
            return res.status(400).json({ msg: 'Invalid status. Must be Active, Inactive, or Suspended.' });
        }

        const manager = await Manager.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).lean();

        if (!manager) return res.status(404).json({ msg: 'Manager not found' });

        res.json({ success: true, msg: `Manager status updated to ${status}.`, manager });
    } catch (err) {
        console.error('Manager directory status update error:', err);
        res.status(500).json({ msg: 'Error updating manager status', error: err.message });
    }
});

// ============================================================
// 13. CASCADING TERRITORY OPTIONS (for filter dropdowns)
// GET /manager-directory/territory-options
// ============================================================
router.get('/manager-directory/territory-options', auth, async (req, res) => {
    try {
        const { state, district, division } = req.query;

        // Master DB Active States
        const states = await State.find({ status: 'Active' }).sort({ name: 1 }).distinct('name');

        let districts = [];
        if (state && state !== 'All') {
            const stDoc = await State.findOne({
                $or: [{ name: safeRegex(state) }, { code: state.toUpperCase() }]
            });
            if (stDoc) {
                districts = await District.find({ stateId: stDoc._id, status: 'Active' }).sort({ name: 1 }).distinct('name');
            }
        }

        let divisions = [];
        if (district && district !== 'All') {
            const distDoc = await District.findOne({ name: safeRegex(district) });
            if (distDoc) {
                divisions = await Division.find({ districtId: distDoc._id, status: 'Active' }).sort({ name: 1 }).distinct('name');
            }
        }

        let pincodes = [];
        if (division && division !== 'All') {
            const divDoc = await Division.findOne({ name: safeRegex(division) });
            if (divDoc) {
                pincodes = await Pincode.find({ divisionId: divDoc._id, status: 'Active' }).sort({ code: 1 }).distinct('code');
            }
        }

        res.json({ success: true, states, districts, divisions, pincodes });
    } catch (err) {
        console.error('Manager directory territory options error:', err);
        res.status(500).json({ msg: 'Error fetching territory options', error: err.message });
    }
});

// ============================================================
// 14. SUBMIT MANAGER ONBOARDING REQUEST
// POST /manager-directory/requests and POST /manager-directory/requests/nominate
// ============================================================
const handleNominateManager = async (req, res) => {
    try {
        const {
            name, email, phone, altPhone, level,
            assignedState, assignedDistrict, assignedDivision, assignedPincode,
            address, notes
        } = req.body;

        if (!name || !email || !phone || !level || !assignedState) {
            return res.status(400).json({
                msg: 'Name, email, phone, manager level, and assigned state are required.'
            });
        }

        const validLevels = ['state', 'district', 'division', 'pincode'];
        if (!validLevels.includes(level.toLowerCase())) {
            return res.status(400).json({
                msg: `Invalid manager level. Must be one of: ${validLevels.join(', ')}`
            });
        }

        // Mandatory Central Territory Database Validation
        const terrValidation = await validateTerritoryHierarchy({
            state: assignedState,
            district: level.toLowerCase() !== 'state' ? assignedDistrict : null,
            division: ['division', 'pincode'].includes(level.toLowerCase()) ? assignedDivision : null,
            pincode: level.toLowerCase() === 'pincode' ? assignedPincode : null,
            requireActive: true
        });

        if (!terrValidation.valid) {
            return res.status(400).json({ msg: terrValidation.message, error: 'INVALID_TERRITORY' });
        }

        // Check manager quota limits (Section 12)
        const MANAGER_LIMITS = { state: 8, district: 2, division: 2, pincode: 2 };
        const maxLimit = MANAGER_LIMITS[level.toLowerCase()] || 2;

        const countFilter = {
            level: level.toLowerCase(),
            status: 'Active',
            assignedState: safeRegex(assignedState)
        };
        if (level.toLowerCase() === 'district') countFilter.assignedDistrict = safeRegex(assignedDistrict || '');
        if (level.toLowerCase() === 'division') countFilter.assignedDivision = safeRegex(assignedDivision || '');
        if (level.toLowerCase() === 'pincode') countFilter.assignedPincode = assignedPincode || '';

        const currentCount = await Manager.countDocuments(countFilter);
        if (currentCount >= maxLimit) {
            return res.status(400).json({
                msg: `Manager limit reached (${currentCount}/${maxLimit}). Cannot submit another onboarding request for this territory.`
            });
        }

        // Duplicate check on email
        const existingMgr = await Manager.findOne({ email: email.toLowerCase().trim() });
        if (existingMgr) {
            return res.status(409).json({ msg: 'A manager with this email already exists.' });
        }

        const existingReq = await ManagerRequest.findOne({
            email: email.toLowerCase().trim(),
            status: 'Pending'
        });
        if (existingReq) {
            return res.status(409).json({ msg: 'A pending onboarding request already exists for this email.' });
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(1000 + Math.random() * 9000);
        const requestId = `REQ-MGR-${level.slice(0, 3).toUpperCase()}-${dateStr}-${rand}`;

        // Get requesting admin info
        let requestingAdminName = req.user?.name || '';
        let requestingAdminRole = req.user?.role || req.user?.adminRole || 'Administrator';
        if (!requestingAdminName && req.user?.id) {
            const u = await User.findById(req.user.id).select('name role adminRole').lean();
            if (u) {
                requestingAdminName = u.name || '';
                requestingAdminRole = u.role || u.adminRole || requestingAdminRole;
            }
        }

        const newRequest = new ManagerRequest({
            requestId,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            altPhone: (altPhone || '').trim(),
            level: level.toLowerCase(),
            assignedState: assignedState.trim(),
            assignedDistrict: (assignedDistrict || '').trim(),
            assignedDivision: (assignedDivision || '').trim(),
            assignedPincode: (assignedPincode || '').trim(),
            address: (address || '').trim(),
            notes: (notes || '').trim(),
            requestedBy: req.user.id,
            requestingAdminName,
            requestingAdminRole,
            status: 'Pending'
        });

        await newRequest.save();

        res.status(201).json({
            success: true,
            msg: `Manager onboarding request submitted successfully for ${name}.`,
            request: newRequest,
            currentCount,
            limit: maxLimit
        });
    } catch (err) {
        console.error('Submit manager request error:', err);
        res.status(500).json({ msg: 'Error submitting manager request', error: err.message });
    }
};

router.post('/manager-directory/requests', auth, handleNominateManager);
router.post('/manager-directory/requests/nominate', auth, handleNominateManager);

module.exports = router;

