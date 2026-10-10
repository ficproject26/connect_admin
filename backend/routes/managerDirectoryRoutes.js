const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const territoryScope = require('../middleware/territoryScope');
const Manager = require('../models/Manager');
const ManagerRequest = require('../models/ManagerRequest');
const Pincode = require('../models/Pincode');
const State = require('../models/State');
const District = require('../models/District');
const Division = require('../models/Division');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const { validateTerritoryHierarchy } = require('./territory');
const TerritoryAssignmentService = require('../utils/territoryAssignmentService');

// Helper: safe string for regex
const safeRegex = (val) => new RegExp(`^${String(val || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

const normalizeManagerLevelStr = (lvl) => {
    if (lvl === 1 || lvl === '1') return 'state';
    if (lvl === 2 || lvl === '2') return 'district';
    if (lvl === 3 || lvl === '3') return 'division';
    if (lvl === 4 || lvl === '4') return 'pincode';
    const s = String(lvl || 'state').trim().toLowerCase();
    if (s === 'state_manager' || s === 'state') return 'state';
    if (s === 'district_manager' || s === 'district') return 'district';
    if (s === 'division_manager' || s === 'division') return 'division';
    if (s === 'pincode_manager' || s === 'pincode') return 'pincode';
    return s || 'state';
};

/**
 * Unified Real-Time Manager Retrieval from Database
 * Aggregates all managers created by Sub-Admins and Main Admin across User & Manager collections
 * Zero mock/seed data. 100% real database records.
 */
async function getUnifiedRealManagers(territoryFilter = {}, options = {}) {
    const { search, state, district, division, pincode, level, status } = options;

    // 1. Fetch from Manager collection
    const rawFromManager = await Manager.find({})
        .populate('parentAdminId', 'name email adminRole adminLevel')
        .populate('approvedBy', 'name email')
        .lean()
        .catch(() => []);

    // 2. Fetch from User collection (where role matches any manager role)
    const rawFromUser = await User.find({
        $or: [
            { role: { $in: ['state_manager', 'district_manager', 'division_manager', 'pincode_manager', 'manager'] } },
            { adminRole: { $in: ['state_manager', 'district_manager', 'division_manager', 'pincode_manager'] } }
        ]
    }).lean().catch(() => []);

    // 3. Normalize all manager records
    const all = [];
    const seenEmails = new Set();
    const seenIds = new Set();

    const normalizeDoc = (doc) => {
        if (!doc) return;
        const docId = String(doc._id || doc.id);
        const email = String(doc.email || '').toLowerCase().trim();

        if (seenIds.has(docId) || (email && seenEmails.has(email))) {
            return;
        }
        if (docId) seenIds.add(docId);
        if (email) seenEmails.add(email);

        const normLevel = normalizeManagerLevelStr(doc.level || doc.role);
        let st = (doc.assignedState || doc.state || '').trim();
        let dist = (doc.assignedDistrict || doc.district || '').trim();
        let div = (doc.assignedDivision || doc.division || '').trim();
        let pin = String(doc.assignedPincode || doc.pincode || '').trim();

        // Standardize status
        const rawStatus = String(doc.status || 'Active').toLowerCase().trim();
        const approvalStage = String(doc.approvalStage || '').toLowerCase().trim();
        let normalizedStatus = 'Active';
        if (rawStatus === 'suspended') normalizedStatus = 'Suspended';
        else if (rawStatus === 'inactive') normalizedStatus = 'Inactive';
        else if (rawStatus === 'rejected') normalizedStatus = 'Rejected';
        else if (approvalStage === 'kyc_review' || rawStatus === 'kyc_review') normalizedStatus = 'KYC Verification';
        else if (['under_review', 'pending', 'pending_approval', 'subadmin_review', 'under_verification'].includes(rawStatus) || approvalStage === 'subadmin_review') {
            normalizedStatus = 'Under Review';
        } else if (['active', 'approved'].includes(rawStatus)) {
            normalizedStatus = 'Active';
        } else {
            normalizedStatus = doc.isActive ? 'Active' : 'Under Review';
        }

        const createdByAdmin = doc.createdByAdmin || doc.adminApprovedBy || doc.parentAdminId?.name || doc.targetAdminName || 'Authorized Admin';
        const createdById = doc.createdById || doc.adminApprovedById || doc.parentAdminId?._id || doc.targetAdminId || '';
        const createdByRole = doc.createdByRole || doc.adminApprovedByRole || doc.parentAdminId?.adminRole || doc.targetAdminRole || 'Admin';

        all.push({
            ...doc,
            _id: doc._id,
            id: doc.id || doc.managerId || `MGR-${normLevel.toUpperCase().slice(0, 3)}-${docId.slice(-6)}`,
            managerId: doc.managerId || doc.id || `MGR-${normLevel.toUpperCase().slice(0, 3)}-${docId.slice(-6)}`,
            name: doc.name || 'Manager',
            email: doc.email || '',
            phone: doc.phone || doc.mobile || '',
            mobile: doc.mobile || doc.phone || '',
            level: normLevel,
            role: doc.role || `${normLevel}_manager`,
            assignedState: st,
            assignedDistrict: dist,
            assignedDivision: div,
            assignedPincode: pin,
            state: st,
            district: dist,
            division: div,
            pincode: pin,
            status: normalizedStatus,
            createdByAdmin,
            createdById,
            createdByRole,
            createdAt: doc.createdAt || new Date(),
            updatedAt: doc.updatedAt || new Date()
        });
    };

    rawFromManager.forEach(normalizeDoc);
    rawFromUser.forEach(normalizeDoc);

    // 4. Territory Filter (enforces strict Sub-Admin territory isolation)
    let filtered = all;
    if (territoryFilter && Object.keys(territoryFilter).length > 0) {
        if (territoryFilter.assignedState) {
            const regex = territoryFilter.assignedState;
            filtered = filtered.filter(m => regex.test ? regex.test(m.assignedState) : String(m.assignedState).toLowerCase() === String(regex).toLowerCase());
        }
        if (territoryFilter.assignedDistrict) {
            const regex = territoryFilter.assignedDistrict;
            filtered = filtered.filter(m => regex.test ? regex.test(m.assignedDistrict) : String(m.assignedDistrict).toLowerCase() === String(regex).toLowerCase());
        }
        if (territoryFilter.assignedDivision) {
            const regex = territoryFilter.assignedDivision;
            filtered = filtered.filter(m => regex.test ? regex.test(m.assignedDivision) : String(m.assignedDivision).toLowerCase() === String(regex).toLowerCase());
        }
        if (territoryFilter.assignedPincode) {
            filtered = filtered.filter(m => String(m.assignedPincode) === String(territoryFilter.assignedPincode));
        }
    }

    // 5. Query Filters (State, District, Division, Pincode, Level, Status)
    if (state && state !== 'All') {
        filtered = filtered.filter(m => String(m.assignedState || '').toLowerCase() === state.toLowerCase());
    }
    if (district && district !== 'All') {
        filtered = filtered.filter(m => String(m.assignedDistrict || '').toLowerCase() === district.toLowerCase());
    }
    if (division && division !== 'All') {
        filtered = filtered.filter(m => String(m.assignedDivision || '').toLowerCase() === division.toLowerCase());
    }
    if (pincode && pincode !== 'All') {
        filtered = filtered.filter(m => String(m.assignedPincode || '') === String(pincode));
    }
    if (level && level !== 'All') {
        const targetLvl = normalizeManagerLevelStr(level);
        filtered = filtered.filter(m => m.level === targetLvl);
    }
    if (status && status !== 'All') {
        filtered = filtered.filter(m => String(m.status || '').toLowerCase() === status.toLowerCase());
    }

    // 6. Search Filter
    if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(m =>
            (m.name || '').toLowerCase().includes(q) ||
            (m.email || '').toLowerCase().includes(q) ||
            (m.phone || '').toLowerCase().includes(q) ||
            (m.mobile || '').toLowerCase().includes(q) ||
            (m.managerId || '').toLowerCase().includes(q) ||
            (m.id || '').toLowerCase().includes(q) ||
            (m.assignedState || '').toLowerCase().includes(q) ||
            (m.assignedDistrict || '').toLowerCase().includes(q) ||
            (m.assignedDivision || '').toLowerCase().includes(q) ||
            (m.assignedPincode || '').toLowerCase().includes(q) ||
            (m.createdByAdmin || '').toLowerCase().includes(q)
        );
    }

    // Sort by createdAt descending
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return filtered;
}

// ============================================================
// 1. SUMMARY KPI COUNTS (Strictly Territory-Scoped)
// GET /manager-directory/summary
// ============================================================
router.get('/manager-directory/summary', [auth, territoryScope], async (req, res) => {
    try {
        const baseFilter = req.territoryFilter || {};
        const managers = await getUnifiedRealManagers(baseFilter);

        const total = managers.length;
        const active = managers.filter(m => m.status === 'Active').length;
        const inactive = managers.filter(m => m.status === 'Inactive' || m.status === 'Suspended').length;
        const pending = await ManagerRequest.countDocuments({ ...baseFilter, status: 'Pending' }).catch(() => 0);

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
// 1B. HIERARCHICAL MANAGERS TREE (State -> District -> Division -> Pincode)
// GET /manager-directory/hierarchy
// ============================================================
router.get('/manager-directory/hierarchy', [auth, territoryScope], async (req, res) => {
    try {
        const managers = await getUnifiedRealManagers(req.territoryFilter, req.query);

        // Structure hierarchical tree
        // STATE -> DISTRICT -> DIVISION -> PINCODE
        const stateMap = {};

        // 1. Collect all distinct states present in the real manager records
        managers.forEach(m => {
            const stName = (m.assignedState || 'Tamil Nadu').trim();
            if (!stateMap[stName]) {
                stateMap[stName] = {
                    state: stName,
                    stateManagers: [],
                    districts: {}
                };
            }
            if (m.level === 'state') {
                stateMap[stName].stateManagers.push(m);
            }
        });

        // 2. Attach District Managers
        managers.forEach(m => {
            if (m.level === 'district') {
                const stName = (m.assignedState || 'Tamil Nadu').trim();
                const distName = (m.assignedDistrict || 'General District').trim();
                if (!stateMap[stName]) {
                    stateMap[stName] = { state: stName, stateManagers: [], districts: {} };
                }
                if (!stateMap[stName].districts[distName]) {
                    stateMap[stName].districts[distName] = {
                        district: distName,
                        state: stName,
                        districtManagers: [],
                        divisions: {}
                    };
                }
                stateMap[stName].districts[distName].districtManagers.push(m);
            }
        });

        // 3. Attach Division Managers
        managers.forEach(m => {
            if (m.level === 'division') {
                const stName = (m.assignedState || 'Tamil Nadu').trim();
                const distName = (m.assignedDistrict || 'General District').trim();
                const divName = (m.assignedDivision || 'General Division').trim();
                if (!stateMap[stName]) {
                    stateMap[stName] = { state: stName, stateManagers: [], districts: {} };
                }
                if (!stateMap[stName].districts[distName]) {
                    stateMap[stName].districts[distName] = { district: distName, state: stName, districtManagers: [], divisions: {} };
                }
                if (!stateMap[stName].districts[distName].divisions[divName]) {
                    stateMap[stName].districts[distName].divisions[divName] = {
                        division: divName,
                        district: distName,
                        state: stName,
                        divisionManagers: [],
                        pincodes: {}
                    };
                }
                stateMap[stName].districts[distName].divisions[divName].divisionManagers.push(m);
            }
        });

        // 4. Attach Pincode Managers
        managers.forEach(m => {
            if (m.level === 'pincode') {
                const stName = (m.assignedState || 'Tamil Nadu').trim();
                const distName = (m.assignedDistrict || 'General District').trim();
                const divName = (m.assignedDivision || 'General Division').trim();
                const pinCode = (m.assignedPincode || 'General PIN').trim();
                if (!stateMap[stName]) {
                    stateMap[stName] = { state: stName, stateManagers: [], districts: {} };
                }
                if (!stateMap[stName].districts[distName]) {
                    stateMap[stName].districts[distName] = { district: distName, state: stName, districtManagers: [], divisions: {} };
                }
                if (!stateMap[stName].districts[distName].divisions[divName]) {
                    stateMap[stName].districts[distName].divisions[divName] = { division: divName, district: distName, state: stName, divisionManagers: [], pincodes: {} };
                }
                if (!stateMap[stName].districts[distName].divisions[divName].pincodes[pinCode]) {
                    stateMap[stName].districts[distName].divisions[divName].pincodes[pinCode] = {
                        pincode: pinCode,
                        division: divName,
                        district: distName,
                        state: stName,
                        pincodeManagers: []
                    };
                }
                stateMap[stName].districts[distName].divisions[divName].pincodes[pinCode].pincodeManagers.push(m);
            }
        });

        // Convert stateMap objects to nested arrays
        const statesTree = Object.values(stateMap).map(st => {
            const districtsArr = Object.values(st.districts).map(d => {
                const divisionsArr = Object.values(d.divisions).map(div => {
                    const pincodesArr = Object.values(div.pincodes).map(p => ({
                        pincode: p.pincode,
                        division: p.division,
                        district: p.district,
                        state: p.state,
                        pincodeManagers: p.pincodeManagers,
                        totalManagers: p.pincodeManagers.length
                    }));

                    const divManagersCount = div.divisionManagers.length + pincodesArr.reduce((sum, p) => sum + p.totalManagers, 0);

                    return {
                        division: div.division,
                        district: div.district,
                        state: div.state,
                        divisionManagers: div.divisionManagers,
                        pincodes: pincodesArr,
                        totalManagers: divManagersCount
                    };
                });

                const distManagersCount = d.districtManagers.length + divisionsArr.reduce((sum, div) => sum + div.totalManagers, 0);

                return {
                    district: d.district,
                    state: d.state,
                    districtManagers: d.districtManagers,
                    divisions: divisionsArr,
                    totalManagers: distManagersCount
                };
            });

            const stateManagersCount = st.stateManagers.length + districtsArr.reduce((sum, d) => sum + d.totalManagers, 0);

            return {
                state: st.state,
                stateManagers: st.stateManagers,
                districts: districtsArr,
                totalManagers: stateManagersCount
            };
        });

        statesTree.sort((a, b) => a.state.localeCompare(b.state));

        res.json({
            success: true,
            totalManagers: managers.length,
            states: statesTree
        });
    } catch (err) {
        console.error('Manager directory hierarchy error:', err);
        res.status(500).json({ msg: 'Error building managers hierarchy', error: err.message });
    }
});

// ============================================================
// 2. FLAT SEARCH / FILTER ALL MANAGERS (Strictly Scoped)
// GET /manager-directory/managers
// ============================================================
router.get('/manager-directory/managers', [auth, territoryScope], async (req, res) => {
    try {
        const { page = 1, limit = 30 } = req.query;
        const managers = await getUnifiedRealManagers(req.territoryFilter, req.query);

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 30);
        const total = managers.length;
        const paginated = managers.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.json({
            success: true,
            managers: paginated,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum) || 1
        });
    } catch (err) {
        console.error('Manager directory search error:', err);
        res.status(500).json({ msg: 'Error searching managers', error: err.message });
    }
});

// ============================================================
// 3. GET MANAGERS FOR A PINCODE
// GET /manager-directory/pincodes/:pincode/managers
// ============================================================
router.get('/manager-directory/pincodes/:pincode/managers', [auth, territoryScope], async (req, res) => {
    try {
        const pincode = decodeURIComponent(req.params.pincode);
        const managers = await getUnifiedRealManagers(req.territoryFilter, {
            ...req.query,
            pincode
        });

        res.json({ success: true, pincode, managers, total: managers.length });
    } catch (err) {
        console.error('Manager directory pincode managers error:', err);
        res.status(500).json({ msg: 'Error fetching managers for pincode', error: err.message });
    }
});

// ============================================================
// 4. GET MANAGER DETAILS BY ID
// GET /manager-directory/managers/:id
// ============================================================
router.get('/manager-directory/managers/:id', [auth, territoryScope], async (req, res) => {
    try {
        const targetId = req.params.id;
        const allManagers = await getUnifiedRealManagers(req.territoryFilter);
        const manager = allManagers.find(m => String(m._id) === targetId || String(m.id) === targetId || String(m.managerId) === targetId);

        if (!manager) return res.status(404).json({ msg: 'Manager not found' });

        res.json({ success: true, manager });
    } catch (err) {
        console.error('Manager directory get manager error:', err);
        res.status(500).json({ msg: 'Error fetching manager', error: err.message });
    }
});

// ============================================================
// 5. GET REAL MANAGER PERFORMANCE & ACTIVITY DETAILS
// GET /manager-directory/managers/:id/performance
// ============================================================
router.get('/manager-directory/managers/:id/performance', [auth, territoryScope], async (req, res) => {
    try {
        const targetId = req.params.id;
        const allManagers = await getUnifiedRealManagers(req.territoryFilter);
        const manager = allManagers.find(m => String(m._id) === targetId || String(m.id) === targetId || String(m.managerId) === targetId);

        if (!manager) return res.status(404).json({ msg: 'Manager not found' });

        const normLevel = normalizeManagerLevelStr(manager.level);
        const st = (manager.assignedState || manager.state || '').trim();
        const dist = (manager.assignedDistrict || manager.district || '').trim();
        const div = (manager.assignedDivision || manager.division || '').trim();
        const pin = (manager.assignedPincode || manager.pincode || '').trim();

        // Territory match filter for shops / vendors in manager's territory
        const vendorTerritoryFilter = {};
        if (st) vendorTerritoryFilter.state = safeRegex(st);
        if (['district', 'division', 'pincode'].includes(normLevel) && dist) {
            vendorTerritoryFilter.district = safeRegex(dist);
        }
        if (['division', 'pincode'].includes(normLevel) && div) {
            vendorTerritoryFilter.division = safeRegex(div);
        }
        if (normLevel === 'pincode' && pin) {
            vendorTerritoryFilter.pincode = pin;
        }

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const vendorOrConditions = [];
        if (Object.keys(vendorTerritoryFilter).length > 0) {
            vendorOrConditions.push(vendorTerritoryFilter);
        }
        if (manager.managerId) vendorOrConditions.push({ managerId: manager.managerId });
        if (manager._id) vendorOrConditions.push({ managerId: String(manager._id) });

        const vendorQuery = vendorOrConditions.length > 0 ? { $or: vendorOrConditions } : {};

        const [
            totalVendors,
            todayVendors,
            thisWeekVendors,
            thisMonthVendors,
            matchingVendors
        ] = await Promise.all([
            Vendor.countDocuments(vendorQuery).catch(() => 0),
            Vendor.countDocuments({ ...vendorQuery, createdAt: { $gte: startOfDay } }).catch(() => 0),
            Vendor.countDocuments({ ...vendorQuery, createdAt: { $gte: startOfWeek } }).catch(() => 0),
            Vendor.countDocuments({ ...vendorQuery, createdAt: { $gte: startOfMonth } }).catch(() => 0),
            Vendor.find(vendorQuery).select('_id id').lean().catch(() => [])
        ]);

        const vendorIds = matchingVendors.map(v => v._id).concat(matchingVendors.map(v => v.id).filter(Boolean));

        let orderQuery = { vendorId: { $in: vendorIds } };
        if (vendorIds.length === 0) {
            orderQuery = { _id: null };
        }

        const [
            totalOrders,
            allOrders,
            todayOrders,
            monthOrders
        ] = await Promise.all([
            Order.countDocuments(orderQuery).catch(() => 0),
            Order.find(orderQuery).select('amount totalAmount finalAmount').lean().catch(() => []),
            Order.find({ ...orderQuery, createdAt: { $gte: startOfDay } }).select('amount totalAmount finalAmount').lean().catch(() => []),
            Order.find({ ...orderQuery, createdAt: { $gte: startOfMonth } }).select('amount totalAmount finalAmount').lean().catch(() => [])
        ]);

        const sumRev = (list) => list.reduce((sum, o) => sum + (Number(o.amount || o.totalAmount || o.finalAmount || 0) || 0), 0);
        const totalRevenue = sumRev(allOrders);
        const todayRevenue = sumRev(todayOrders);
        const thisMonthRevenue = sumRev(monthOrders);

        const customerFilter = {};
        if (pin) customerFilter.pincode = pin;
        else if (st) customerFilter.address = safeRegex(st);
        const totalCustomers = Object.keys(customerFilter).length > 0 ? await Customer.countDocuments(customerFilter).catch(() => 0) : 0;

        let totalBookings = 0;
        try {
            if (vendorIds.length > 0) {
                totalBookings = await Booking.countDocuments({ vendorId: { $in: vendorIds } });
            }
        } catch {}

        res.json({
            success: true,
            manager,
            performance: {
                totalShopsTiedUp: totalVendors,
                todayShopsTiedUp: todayVendors,
                thisWeekShopsTiedUp: thisWeekVendors,
                thisMonthShopsTiedUp: thisMonthVendors,
                totalRevenue,
                todayRevenue,
                thisMonthRevenue,
                totalCustomers,
                totalVendors,
                totalOrders,
                totalBookings
            }
        });
    } catch (err) {
        console.error('Manager performance error:', err);
        res.status(500).json({ msg: 'Error computing manager performance', error: err.message });
    }
});

// ============================================================
// 6. UPDATE MANAGER STATUS (activate / suspend / reactivate)
// PUT /manager-directory/managers/:id/status
// ============================================================
router.put('/manager-directory/managers/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const targetId = req.params.id;

        if (!status || !['Active', 'Inactive', 'Suspended'].includes(status)) {
            return res.status(400).json({ msg: 'Invalid status. Must be Active, Inactive, or Suspended.' });
        }

        const normStatus = status;
        const userStatus = status.toLowerCase();
        const isUserActive = status === 'Active';

        // Update in Manager collection if exists
        let updatedManager = null;
        if (mongoose.Types.ObjectId.isValid(targetId)) {
            updatedManager = await Manager.findByIdAndUpdate(targetId, { status: normStatus }, { new: true }).lean().catch(() => null);
        }
        if (!updatedManager) {
            updatedManager = await Manager.findOneAndUpdate(
                { $or: [{ id: targetId }, { managerId: targetId }] },
                { status: normStatus },
                { new: true }
            ).lean().catch(() => null);
        }

        // Update in User collection
        let updatedUser = null;
        if (mongoose.Types.ObjectId.isValid(targetId)) {
            updatedUser = await User.findByIdAndUpdate(targetId, { status: userStatus, isActive: isUserActive }, { new: true }).lean().catch(() => null);
        }
        if (!updatedUser) {
            updatedUser = await User.findOneAndUpdate(
                { $or: [{ _id: targetId }, { id: targetId }, { managerId: targetId }] },
                { status: userStatus, isActive: isUserActive },
                { new: true }
            ).lean().catch(() => null);
        }

        if (!updatedManager && !updatedUser) {
            return res.status(404).json({ msg: 'Manager not found in database' });
        }

        res.json({
            success: true,
            msg: `Manager status successfully updated to ${status}.`,
            status: normStatus
        });
    } catch (err) {
        console.error('Manager directory status update error:', err);
        res.status(500).json({ msg: 'Error updating manager status', error: err.message });
    }
});

// ============================================================
// 7. DELETE MANAGER
// DELETE /manager-directory/managers/:id
// ============================================================
router.delete('/manager-directory/managers/:id', auth, async (req, res) => {
    try {
        const targetId = req.params.id;

        let deletedFromManager = null;
        if (mongoose.Types.ObjectId.isValid(targetId)) {
            deletedFromManager = await Manager.findByIdAndDelete(targetId).catch(() => null);
        }
        if (!deletedFromManager) {
            deletedFromManager = await Manager.findOneAndDelete({ $or: [{ id: targetId }, { managerId: targetId }] }).catch(() => null);
        }

        let deletedFromUser = null;
        if (mongoose.Types.ObjectId.isValid(targetId)) {
            deletedFromUser = await User.findByIdAndDelete(targetId).catch(() => null);
        }
        if (!deletedFromUser) {
            deletedFromUser = await User.findOneAndDelete({ $or: [{ _id: targetId }, { id: targetId }, { managerId: targetId }] }).catch(() => null);
        }

        if (!deletedFromManager && !deletedFromUser) {
            return res.status(404).json({ msg: 'Manager record not found to delete' });
        }

        res.json({ success: true, msg: 'Manager record successfully deleted from database.' });
    } catch (err) {
        console.error('Manager directory delete error:', err);
        res.status(500).json({ msg: 'Error deleting manager', error: err.message });
    }
});

// ============================================================
// 8. CASCADING TERRITORY OPTIONS (Strictly from real database managers)
// GET /manager-directory/territory-options
// ============================================================
router.get('/manager-directory/territory-options', [auth, territoryScope], async (req, res) => {
    try {
        const { state, district, division } = req.query;
        const managers = await getUnifiedRealManagers(req.territoryFilter);

        const statesSet = new Set();
        const districtsSet = new Set();
        const divisionsSet = new Set();
        const pincodesSet = new Set();

        managers.forEach(m => {
            const st = (m.assignedState || m.state || '').trim();
            const dist = (m.assignedDistrict || m.district || '').trim();
            const div = (m.assignedDivision || m.division || '').trim();
            const pin = String(m.assignedPincode || m.pincode || '').trim();

            if (st) statesSet.add(st);

            // Filter districts for selected state
            if (dist) {
                if (!state || state === 'All' || st.toLowerCase() === state.toLowerCase()) {
                    districtsSet.add(dist);
                }
            }

            // Filter divisions for selected district
            if (div) {
                const matchState = !state || state === 'All' || st.toLowerCase() === state.toLowerCase();
                const matchDist = !district || district === 'All' || dist.toLowerCase() === district.toLowerCase();
                if (matchState && matchDist) {
                    divisionsSet.add(div);
                }
            }

            // Filter pincodes for selected division
            if (pin) {
                const matchState = !state || state === 'All' || st.toLowerCase() === state.toLowerCase();
                const matchDist = !district || district === 'All' || dist.toLowerCase() === district.toLowerCase();
                const matchDiv = !division || division === 'All' || div.toLowerCase() === division.toLowerCase();
                if (matchState && matchDist && matchDiv) {
                    pincodesSet.add(pin);
                }
            }
        });

        // Enrich with Pincode collection if state has entries in DB
        if (statesSet.size === 0) {
            const pins = await Pincode.find({}).limit(50).lean().catch(() => []);
            pins.forEach(p => {
                statesSet.add(p.state);
                districtsSet.add(p.district);
                divisionsSet.add(p.division || p.area || 'General');
                pincodesSet.add(p.code);
            });
        }

        res.json({
            success: true,
            states: Array.from(statesSet).filter(Boolean).sort(),
            districts: Array.from(districtsSet).filter(Boolean).sort(),
            divisions: Array.from(divisionsSet).filter(Boolean).sort(),
            pincodes: Array.from(pincodesSet).filter(Boolean).sort()
        });
    } catch (err) {
        console.error('Manager directory territory options error:', err);
        res.status(500).json({ msg: 'Error fetching territory options', error: err.message });
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
        else if (!status) query.status = 'Pending';

        if (level && level !== 'All') query.level = normalizeManagerLevelStr(level);
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

        // Auto-mirror any pending manager users from 'users' into 'managerrequests'
        try {
            const pendingUsers = await User.find({
                $or: [
                    { role: { $in: ['state_manager', 'district_manager', 'division_manager', 'pincode_manager', 'manager'] } },
                    { level: { $in: [1, 2, 3, 4, '1', '2', '3', '4', 'state', 'district', 'division', 'pincode'] }, role: /manager/i }
                ],
                status: { $in: ['under_review', 'pending', 'pending_approval', 'subadmin_review', 'kyc_review', 'pending_verification'] }
            }).select('-password -passwordHash').lean().catch(() => []);

            for (const pu of pendingUsers) {
                const userEmail = (pu.email || '').toLowerCase().trim();
                const existing = await ManagerRequest.findOne({
                    $or: [
                        { userId: String(pu._id) },
                        ...(userEmail ? [{ email: userEmail }] : [])
                    ]
                });
                if (!existing) {
                    const normLvl = normalizeManagerLevelStr(pu.level || pu.role);
                    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    const rand = Math.floor(1000 + Math.random() * 9000);
                    const reqId = pu.registrationId || `REQ-MGR-${normLvl.slice(0, 3).toUpperCase()}-${dateStr}-${rand}`;
                    await ManagerRequest.create({
                        requestId: reqId,
                        userId: String(pu._id),
                        name: pu.name || 'Manager Applicant',
                        email: userEmail,
                        phone: pu.phone || pu.mobile || '',
                        altPhone: pu.altPhone || '',
                        level: normLvl,
                        assignedState: pu.assignedState || pu.state || '',
                        assignedDistrict: pu.assignedDistrict || pu.district || '',
                        assignedDivision: pu.assignedDivision || pu.division || '',
                        assignedPincode: pu.assignedPincode || pu.pincode || '',
                        address: pu.address || pu.fullAddress || '',
                        notes: 'Synced from Manager registration application',
                        status: pu.status === 'rejected' ? 'Rejected' : 'Pending',
                        approvalStage: pu.approvalStage || (pu.status === 'under_review' ? 'subadmin_review' : 'subadmin_review'),
                        documents: pu.documents || pu.kycDocs || {},
                        createdAt: pu.createdAt || new Date()
                    }).catch(() => {});
                }
            }
        } catch (syncErr) {
            console.warn('Auto-sync pending manager users error:', syncErr.message);
        }

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

        const formattedRequests = requests.map(r => ({
            ...r,
            phone: r.phone || r.mobile || '',
            level: normalizeManagerLevelStr(r.level),
            approvalStage: r.approvalStage || (r.status === 'Approved' ? 'approved' : 'subadmin_review')
        }));

        res.json({
            success: true,
            requests: formattedRequests,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)) || 1
        });
    } catch (err) {
        console.error('Manager directory requests error:', err);
        res.status(500).json({ msg: 'Error fetching requests', error: err.message });
    }
});

// ============================================================
// 10. APPROVE MANAGER REQUEST (TWO-STAGE APPROVAL WORKFLOW)
// PUT /manager-directory/requests/:id/approve and /approve-kyc
// ============================================================
const handleApproveManagerRequest = async (req, res) => {
    try {
        const mReq = await ManagerRequest.findById(req.params.id);
        if (!mReq) return res.status(404).json({ msg: 'Manager request not found' });
        if (mReq.status === 'Approved') return res.status(400).json({ msg: 'Request is already fully approved.' });
        if (mReq.status === 'Rejected') return res.status(400).json({ msg: 'Request has been rejected.' });

        const isKycStage = req.path.includes('approve-kyc') || req.query.stage === 'kyc' || req.body.stage === 'kyc' || mReq.approvalStage === 'kyc_review' || req.body.directActivate;
        const normLevel = normalizeManagerLevelStr(mReq.level);

        // Fetch operator identity
        let operatorName = req.user?.name || 'Administrator';
        let operatorRole = req.user?.role || req.user?.adminRole || 'admin';
        if (req.user?.id) {
            const u = await User.findById(req.user.id).select('name role adminRole').lean();
            if (u) {
                operatorName = u.name || operatorName;
                operatorRole = u.role || u.adminRole || operatorRole;
            }
        }

        if (isKycStage) {
            // =====================================================
            // STAGE 2: KYC TEAM / FINAL APPROVAL -> ACTIVATE MANAGER
            // =====================================================
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const rand = Math.floor(1000 + Math.random() * 9000);
            const managerId = `MGR-${normLevel.slice(0, 3).toUpperCase()}-${dateStr}-${rand}`;

            // Create or update in Manager collection
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
                    altPhone: mReq.altPhone || '',
                    level: normLevel,
                    assignedState: mReq.assignedState,
                    assignedDistrict: mReq.assignedDistrict || '',
                    assignedDivision: mReq.assignedDivision || '',
                    assignedPincode: mReq.assignedPincode || '',
                    address: mReq.address || '',
                    notes: mReq.notes || '',
                    parentAdminId: mReq.requestedBy || req.user.id,
                    requestedBy: mReq.requestedBy,
                    approvedBy: req.user.id,
                    status: 'Active'
                });
                await newManager.save();
            } else {
                newManager.status = 'Active';
                newManager.approvedBy = req.user.id;
                await newManager.save();
            }

            mReq.status = 'Approved';
            mReq.approvalStage = 'approved';
            mReq.kycApprovedBy = req.user.id;
            mReq.kycApprovedByName = operatorName;
            mReq.kycApprovedAt = new Date();
            mReq.reviewedBy = req.user.id;
            mReq.reviewedAt = new Date();
            await mReq.save();

            // Update matching User document to Active
            const userFilter = mReq.userId ? { _id: mReq.userId } : { email: mReq.email.toLowerCase().trim() };
            await User.findOneAndUpdate(userFilter, {
                status: 'active',
                approvalStage: 'approved',
                kycStatus: 'Verified',
                isActive: true,
                isApproved: true,
                managerId: newManager.managerId
            });

            // Emit real-time notification
            try {
                const io = req.app.get('io');
                if (io) {
                    io.to('admin').emit('manager_activated', {
                        id: newManager._id,
                        managerId: newManager.managerId,
                        name: newManager.name,
                        email: newManager.email,
                        level: normLevel,
                        status: 'Active'
                    });
                }
            } catch (ioErr) {}

            return res.json({
                success: true,
                stage: 'approved',
                msg: `Manager KYC approved and activated. ${mReq.name} is now an active ${normLevel} manager.`,
                manager: newManager,
                request: mReq
            });
        } else {
            // =====================================================
            // STAGE 1: SUB-ADMIN TERRITORY APPROVAL -> KYC REVIEW
            // =====================================================
            mReq.approvalStage = 'kyc_review';
            mReq.subadminApprovedBy = req.user.id;
            mReq.subadminApprovedByName = operatorName;
            mReq.subadminApprovedAt = new Date();
            mReq.status = 'Pending'; // Remains Pending until KYC approval
            await mReq.save();

            // Update User to KYC review stage
            const userFilter = mReq.userId ? { _id: mReq.userId } : { email: mReq.email.toLowerCase().trim() };
            await User.findOneAndUpdate(userFilter, {
                status: 'under_review',
                approvalStage: 'kyc_review',
                kycStatus: 'pending_verification',
                subadminApprovedBy: req.user.id,
                subadminApprovedByName: operatorName,
                subadminApprovedAt: new Date()
            });

            // Emit real-time notification to KYC team and admin
            try {
                const io = req.app.get('io');
                if (io) {
                    const payload = {
                        _id: mReq._id,
                        requestId: mReq.requestId,
                        name: mReq.name,
                        email: mReq.email,
                        level: normLevel,
                        approvalStage: 'kyc_review',
                        subadminApprovedByName: operatorName,
                        createdAt: new Date()
                    };
                    io.to('admin').emit('manager_stage1_approved', payload);
                    io.to('admin').emit('new_kyc_request', payload);
                }
            } catch (ioErr) {}

            return res.json({
                success: true,
                stage: 'kyc_review',
                msg: `Stage 1 territory review approved by ${operatorName}. Sent to KYC Verification team for final review.`,
                request: mReq
            });
        }
    } catch (err) {
        console.error('Manager directory approve error:', err);
        res.status(500).json({ msg: 'Error approving request', error: err.message });
    }
};

router.put('/manager-directory/requests/:id/approve', auth, handleApproveManagerRequest);
router.put('/manager-directory/requests/:id/approve-kyc', auth, handleApproveManagerRequest);

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

        const rejectionReason = (req.body.reason || req.body.rejectionReason || '').trim() || 'Rejected by Administrator';

        mReq.status = 'Rejected';
        mReq.approvalStage = 'rejected';
        mReq.rejectionReason = rejectionReason;
        mReq.reviewedBy = req.user.id;
        mReq.reviewedAt = new Date();
        await mReq.save();

        // Synchronize rejection to User record
        const userFilter = mReq.userId ? { _id: mReq.userId } : { email: mReq.email.toLowerCase().trim() };
        await User.findOneAndUpdate(userFilter, {
            status: 'rejected',
            approvalStage: 'rejected',
            rejectionReason
        });

        res.json({ success: true, msg: 'Manager request rejected.', request: mReq });
    } catch (err) {
        console.error('Manager directory reject error:', err);
        res.status(500).json({ msg: 'Error rejecting request', error: err.message });
    }
});

// ============================================================
// 12. SUBMIT MANAGER ONBOARDING REQUEST
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
        const normLevel = normalizeManagerLevelStr(level);
        if (!validLevels.includes(normLevel)) {
            return res.status(400).json({
                msg: `Invalid manager level. Must be one of: ${validLevels.join(', ')}`
            });
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
        const requestId = `REQ-MGR-${normLevel.slice(0, 3).toUpperCase()}-${dateStr}-${rand}`;

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
            level: normLevel,
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
            request: newRequest
        });
    } catch (err) {
        console.error('Submit manager request error:', err);
        res.status(500).json({ msg: 'Error submitting manager request', error: err.message });
    }
};

router.post('/manager-directory/requests', auth, handleNominateManager);
router.post('/manager-directory/requests/nominate', auth, handleNominateManager);

module.exports = router;
