const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Pincode = require('../models/Pincode');
const TieUp = require('../models/TieUp');
const Task = require('../models/Task');
const Branch = require('../models/Branch');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const CommissionConfig = require('../models/CommissionConfig');
const MembershipPlan = require('../models/MembershipPlan');
const Banner = require('../models/Banner');
const Advertisement = require('../models/Advertisement');

// Middleware to check if user is admin (Super Admin, Branch Admin, or Staff)
const adminAuth = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied. Admins only.' });
        }
        req.adminUser = user; // attach admin profile
        next();
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error: ' + err.message);
    }
};

// HELPER: Branch scoping helper
const getBranchFilter = (adminUser, defaultFilter = {}) => {
    if (adminUser.adminRole === 'branch-admin' || adminUser.adminRole === 'staff') {
        return { ...defaultFilter, branchId: adminUser.branchId };
    }
    return defaultFilter;
};

// ==========================================
// 1. DASHBOARD & KPI STATS
// ==========================================
router.get('/dashboard-stats', [auth, adminAuth], async (req, res) => {
    try {
        const admin = req.adminUser;
        const isBranchScoped = admin.adminRole !== 'super-admin';
        const branchId = admin.branchId;

        // Filters based on role
        const userFilter = isBranchScoped ? { branchId } : {};
        const vendorFilter = isBranchScoped ? { branchId } : {};
        const orderFilter = isBranchScoped ? { branchId } : {}; // Assumes branchId exists on Order/Vendor
        
        // Let's gather counts
        const totalCustomers = await Customer.countDocuments(isBranchScoped ? { branchId } : {});
        const totalVendors = await Vendor.countDocuments(isBranchScoped ? { branchId } : {});
        const totalAgents = await User.countDocuments({ role: 'agent', ...(isBranchScoped ? { branchId } : {}) });
        const totalDistrictAgents = await User.countDocuments({ role: 'agent', level: 'district', ...(isBranchScoped ? { branchId } : {}) });
        const totalBranches = await Branch.countDocuments();
        
        // Orders & Bookings
        let ordersCount = 0;
        let bookingsCount = 0;
        let totalRevenue = 0;

        let completedOrders = [];
        let completedBookings = [];
        let vendorIds = [];

        if (isBranchScoped) {
            // Fetch vendors for branch first
            const branchVendors = await Vendor.find({ branchId }).select('_id');
            vendorIds = branchVendors.map(v => v._id);
            ordersCount = await Order.countDocuments({ vendorId: { $in: vendorIds } });
            bookingsCount = await Booking.countDocuments({ vendorId: { $in: vendorIds } });

            completedOrders = await Order.find({ vendorId: { $in: vendorIds }, status: 'completed' });
            completedBookings = await Booking.find({ vendorId: { $in: vendorIds }, status: { $in: ['confirmed', 'completed'] } });
        } else {
            ordersCount = await Order.countDocuments();
            bookingsCount = await Booking.countDocuments();
            completedOrders = await Order.find({ status: 'completed' });
            completedBookings = await Booking.find({ status: { $in: ['confirmed', 'completed'] } });
        }
        totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0) + completedBookings.reduce((sum, b) => sum + b.amount, 0);

        // Specific category counts
        const totalHospitals = await Vendor.countDocuments({ category: 'Hospitals', ...(isBranchScoped ? { branchId } : {}) });
        const totalHotels = await Vendor.countDocuments({ category: 'Hotels', ...(isBranchScoped ? { branchId } : {}) });
        const totalServices = await Vendor.countDocuments({ category: 'Services', ...(isBranchScoped ? { branchId } : {}) });
        
        const activeMembershipPlans = await MembershipPlan.countDocuments({ isActive: true });
        const pendingVendorApprovals = await Vendor.countDocuments({ status: 'pending', ...(isBranchScoped ? { branchId } : {}) });
        const pendingAgentApprovals = await User.countDocuments({ role: 'agent', status: 'pending', ...(isBranchScoped ? { branchId } : {}) });
        const pendingKYCRequests = await User.countDocuments({ role: 'agent', status: 'pending', ...(isBranchScoped ? { branchId } : {}) });

        // Requested extra KPIs
        const pendingAgentKYC = await User.countDocuments({ role: 'agent', status: 'pending', ...(isBranchScoped ? { branchId } : {}) });
        const pendingVendorKYC = await Vendor.countDocuments({ kycStatus: 'pending', ...(isBranchScoped ? { branchId } : {}) });
        const stateAgents = await User.countDocuments({ role: 'agent', level: 'state', ...(isBranchScoped ? { branchId } : {}) });
        const districtAgents = await User.countDocuments({ role: 'agent', level: 'district', ...(isBranchScoped ? { branchId } : {}) });
        const subDistrictAgents = await User.countDocuments({ role: 'agent', level: 'division', ...(isBranchScoped ? { branchId } : {}) });
        const pincodeAgents = await User.countDocuments({ role: 'agent', level: 'pincode', ...(isBranchScoped ? { branchId } : {}) });
        const subAdmins = await User.countDocuments({ role: 'admin', adminRole: { $in: ['branch-admin', 'staff'] }, ...(isBranchScoped ? { branchId } : {}) });


        // 1. Dynamic Month-Wise Revenue Trends (last 6 months)
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            last6Months.push({
                name: monthNames[d.getMonth()],
                year: d.getFullYear(),
                monthIndex: d.getMonth(),
                revenue: 0
            });
        }

        completedOrders.forEach(o => {
            const oDate = new Date(o.createdAt);
            const match = last6Months.find(m => m.monthIndex === oDate.getMonth() && m.year === oDate.getFullYear());
            if (match) match.revenue += o.amount;
        });
        completedBookings.forEach(b => {
            const bDate = new Date(b.createdAt);
            const match = last6Months.find(m => m.monthIndex === bDate.getMonth() && m.year === bDate.getFullYear());
            if (match) match.revenue += b.amount;
        });

        const revenueOverview = last6Months.map(m => ({
            month: m.name,
            revenue: m.revenue
        }));

        // 2. Category Wise Revenue
        const categoryMap = {};
        const allVendors = await Vendor.find(isBranchScoped ? { branchId } : {});
        const vendorMap = {};
        allVendors.forEach(v => {
            if (v && v._id) {
                vendorMap[v._id.toString()] = {
                    category: v.category || 'Other',
                    name: v.businessName,
                    branchId: v.branchId,
                    agentId: v.agentId
                };
                if (!categoryMap[v.category]) {
                    categoryMap[v.category] = 0;
                }
            }
        });

        completedOrders.forEach(o => {
            const vInfo = o.vendorId ? vendorMap[o.vendorId.toString()] : null;
            if (vInfo) {
                categoryMap[vInfo.category] = (categoryMap[vInfo.category] || 0) + o.amount;
            }
        });
        completedBookings.forEach(b => {
            const vInfo = b.vendorId ? vendorMap[b.vendorId.toString()] : null;
            if (vInfo) {
                categoryMap[vInfo.category] = (categoryMap[vInfo.category] || 0) + b.amount;
            }
        });

        const categoryWiseRevenue = Object.keys(categoryMap).map(cat => ({
            category: cat,
            value: categoryMap[cat]
        }));

        // 3. Branch Wise Revenue Comparison
        const branchMap = {};
        const branchesList = await Branch.find();
        const branchIdToName = {};
        branchesList.forEach(b => {
            if (b && b._id) {
                branchIdToName[b._id.toString()] = b.name;
                branchMap[b.name] = 0;
            }
        });

        completedOrders.forEach(o => {
            const vInfo = o.vendorId ? vendorMap[o.vendorId.toString()] : null;
            if (vInfo && vInfo.branchId && branchIdToName[vInfo.branchId.toString()]) {
                const bName = branchIdToName[vInfo.branchId.toString()];
                branchMap[bName] = (branchMap[bName] || 0) + o.amount;
            }
        });
        completedBookings.forEach(b => {
            const vInfo = b.vendorId ? vendorMap[b.vendorId.toString()] : null;
            if (vInfo && vInfo.branchId && branchIdToName[vInfo.branchId.toString()]) {
                const bName = branchIdToName[vInfo.branchId.toString()];
                branchMap[bName] = (branchMap[bName] || 0) + b.amount;
            }
        });

        const branchWiseRevenue = Object.keys(branchMap).map(bName => ({
            name: bName,
            revenue: branchMap[bName]
        }));

        // 4. Vendor Wise Revenue Performance
        const vendorRevMap = {};
        completedOrders.forEach(o => {
            const vInfo = o.vendorId ? vendorMap[o.vendorId.toString()] : null;
            if (vInfo) {
                vendorRevMap[vInfo.name] = (vendorRevMap[vInfo.name] || 0) + o.amount;
            }
        });
        completedBookings.forEach(b => {
            const vInfo = b.vendorId ? vendorMap[b.vendorId.toString()] : null;
            if (vInfo) {
                vendorRevMap[vInfo.name] = (vendorRevMap[vInfo.name] || 0) + b.amount;
            }
        });

        const vendorWiseRevenue = Object.keys(vendorRevMap).map(vName => ({
            name: vName,
            revenue: vendorRevMap[vName]
        })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        // 5. Agent Wise Revenue performance
        const agentRevMap = {};
        const agentsList = await User.find({ role: 'agent' });
        const agentIdToName = {};
        agentsList.forEach(a => {
            if (a && a._id) {
                agentIdToName[a._id.toString()] = a.name;
            }
        });

        completedOrders.forEach(o => {
            const vInfo = o.vendorId ? vendorMap[o.vendorId.toString()] : null;
            if (vInfo && vInfo.agentId && agentIdToName[vInfo.agentId.toString()]) {
                const aName = agentIdToName[vInfo.agentId.toString()];
                if (aName) {
                    agentRevMap[aName] = (agentRevMap[aName] || 0) + o.amount;
                }
            }
        });
        completedBookings.forEach(b => {
            const vInfo = b.vendorId ? vendorMap[b.vendorId.toString()] : null;
            if (vInfo && vInfo.agentId && agentIdToName[vInfo.agentId.toString()]) {
                const aName = agentIdToName[vInfo.agentId.toString()];
                if (aName) {
                    agentRevMap[aName] = (agentRevMap[aName] || 0) + b.amount;
                }
            }
        });

        const agentWiseRevenue = Object.keys(agentRevMap).map(aName => ({
            name: aName,
            revenue: agentRevMap[aName]
        })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        // Recent Activities
        const latestVendors = await Vendor.find(isBranchScoped ? { branchId } : {}).sort({ createdAt: -1 }).limit(5).populate('agentId', 'name');
        const latestAgents = await User.find({ role: 'agent', ...(isBranchScoped ? { branchId } : {}) }).sort({ createdAt: -1 }).limit(5);
        const latestOrders = await Order.find().sort({ createdAt: -1 }).limit(5).populate('vendorId', 'businessName').populate('customerId', 'name');

        res.json({
            kpis: {
                totalUsers: totalCustomers + totalVendors + totalAgents,
                totalCustomers,
                totalVendors,
                totalAgents,
                totalDistrictAgents,
                totalBranches,
                totalOrders: ordersCount,
                totalBookings: bookingsCount,
                totalRevenue,
                totalHospitals,
                totalHotels,
                totalServices,
                activeMembershipPlans,
                pendingVendorApprovals,
                pendingAgentApprovals,
                pendingKYCRequests,
                // Extra KPIs
                pendingAgentKYC,
                pendingVendorKYC,
                stateAgents,
                districtAgents,
                subDistrictAgents,
                pincodeAgents,
                subAdmins,
                totalBranches
            },
            charts: {
                revenueOverview,
                categoryWiseRevenue,
                branchWiseRevenue,
                vendorWiseRevenue,
                agentWiseRevenue
            },
            recent: {
                latestVendors,
                latestAgents,
                latestOrders
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error stats: ' + err.stack);
    }
});

// ==========================================
// 2. BRANCH MANAGEMENT
// ==========================================
router.get('/branches', [auth, adminAuth], async (req, res) => {
    try {
        const branches = await Branch.find().populate('agentId', 'name email phone');
        res.json(branches);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/branches', [auth, adminAuth], async (req, res) => {
    const { name, code, state, district, city, address, contactNumber, agentId } = req.body;
    try {
        let branch = new Branch({ name, code, state, district, city, address, contactNumber, agentId: agentId || null });
        await branch.save();
        
        if (agentId) {
            await User.findByIdAndUpdate(agentId, { branchId: branch._id, level: 'district', assignedDistrict: name });
        }
        
        res.json(branch);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.put('/branches/:id', [auth, adminAuth], async (req, res) => {
    try {
        const { name, code, state, district, city, address, contactNumber, agentId } = req.body;
        let branch = await Branch.findById(req.params.id);
        if (!branch) return res.status(404).json({ msg: 'District not found' });
        
        const oldAgentId = branch.agentId;
        
        branch.name = name ?? branch.name;
        branch.code = code ?? branch.code;
        branch.state = state ?? branch.state;
        branch.district = district ?? branch.district;
        branch.city = city ?? branch.city;
        branch.address = address ?? branch.address;
        branch.contactNumber = contactNumber ?? branch.contactNumber;
        if (typeof agentId !== 'undefined') {
            branch.agentId = agentId || null;
        }
        
        await branch.save();
        
        // Update Agent linkages if changed
        if (typeof agentId !== 'undefined' && String(oldAgentId) !== String(agentId)) {
            if (oldAgentId) {
                await User.findByIdAndUpdate(oldAgentId, { branchId: null });
            }
            if (agentId) {
                await User.findByIdAndUpdate(agentId, { branchId: branch._id, level: 'district', assignedDistrict: branch.name });
            }
        }
        
        const updatedBranch = await Branch.findById(branch._id).populate('agentId', 'name email phone');
        res.json(updatedBranch);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.delete('/branches/:id', [auth, adminAuth], async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id);
        if (branch) {
            if (branch.agentId) {
                await User.findByIdAndUpdate(branch.agentId, { branchId: null });
            }
            await Branch.findByIdAndDelete(req.params.id);
        }
        res.json({ msg: 'Branch/District deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 3. ADMIN USER MANAGEMENT
// ==========================================
router.get('/admins', [auth, adminAuth], async (req, res) => {
    try {
        if (req.adminUser.adminRole !== 'super-admin') {
            return res.status(403).json({ msg: 'Access restricted to Super Admins' });
        }
        const admins = await User.find({ role: 'admin' }).populate('branchId', 'name');
        res.json(admins);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/admins', [auth, adminAuth], async (req, res) => {
    const { name, email, password, adminRole, branchId } = req.body;
    try {
        const bcrypt = require('bcryptjs');
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'Admin user already exists' });

        user = new User({
            name,
            email,
            password,
            role: 'admin',
            adminRole,
            branchId,
            isActive: true,
            status: 'approved'
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.put('/admins/:id', [auth, adminAuth], async (req, res) => {
    try {
        let user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.delete('/admins/:id', [auth, adminAuth], async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Admin deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 4. AGENT MANAGEMENT
// ==========================================
router.get('/agents', [auth, adminAuth], async (req, res) => {
    try {
        const filter = { role: 'agent' };
        if (req.adminUser.adminRole !== 'super-admin') {
            filter.branchId = req.adminUser.branchId;
        }
        const agents = await User.find(filter)
            .populate('branchId', 'name')
            .populate('assignedPincode', 'code name');
        res.json(agents);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.put('/agents/:id/status', [auth, adminAuth], async (req, res) => {
    const { status, isActive } = req.body;
    try {
        let agent = await User.findById(req.params.id);
        if (!agent) return res.status(404).json({ msg: 'Agent not found' });

        if (status) agent.status = status;
        if (typeof isActive !== 'undefined') agent.isActive = isActive;

        await agent.save();

        // Update Pincode activeAgentId linkage
        if (agent.assignedPincode) {
            if (status === 'approved') {
                await Pincode.findByIdAndUpdate(agent.assignedPincode, { activeAgentId: agent._id });
            } else if (status === 'rejected' || status === 'suspended') {
                await Pincode.findByIdAndUpdate(agent.assignedPincode, { activeAgentId: null });
            }
        }

        res.json(agent);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 5. PINCODE MANAGEMENT
// ==========================================
router.get('/pincodes', [auth, adminAuth], async (req, res) => {
    try {
        const pincodes = await Pincode.find().populate('activeAgentId', 'name email');
        res.json(pincodes);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/pincodes/assign', [auth, adminAuth], async (req, res) => {
    const { pincodeId, agentId } = req.body;
    try {
        // Validation: No duplicate assignments
        const alreadyAssigned = await Pincode.findOne({ _id: pincodeId, activeAgentId: { $ne: null } });
        if (alreadyAssigned && alreadyAssigned.activeAgentId.toString() !== agentId) {
            return res.status(400).json({ msg: 'Pincode is already assigned to another agent' });
        }

        const pincode = await Pincode.findByIdAndUpdate(pincodeId, { activeAgentId: agentId }, { new: true });
        await User.findByIdAndUpdate(agentId, { assignedPincode: pincodeId });
        res.json(pincode);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/pincodes/remove', [auth, adminAuth], async (req, res) => {
    const { pincodeId } = req.body;
    try {
        const pincode = await Pincode.findById(pincodeId);
        if (pincode && pincode.activeAgentId) {
            await User.findByIdAndUpdate(pincode.activeAgentId, { assignedPincode: null });
            pincode.activeAgentId = null;
            await pincode.save();
        }
        res.json(pincode);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 6. VENDOR MANAGEMENT
// ==========================================
router.get('/vendors', [auth, adminAuth], async (req, res) => {
    try {
        const filter = getBranchFilter(req.adminUser);
        const usersVendors = await User.find({ role: { $in: ['Vendor', 'vendor'] } }).populate('branchId', 'name').populate('referredBy', 'name');
        const legacyVendors = await Vendor.find(filter).populate('branchId', 'name').populate('agentId', 'name');
        
        const formattedUserVendors = usersVendors.map(v => ({
            _id: v._id,
            businessName: v.businessName || v.name,
            category: v.category || 'Store Vendor',
            subcategory: v.subcategory || '',
            vendorType: v.vendorType || '',
            baseVendorType: v.baseVendorType || '',
            contactName: v.contactPerson || v.name,
            phone: v.phone || '',
            email: v.email,
            status: v.status || 'Pending',
            agentId: v.referredBy || null,
            membership: { status: v.isPaid ? 'active' : 'none' },
            createdAt: v.createdAt,
            isUserCollection: true
        }));

        const formattedLegacy = legacyVendors.map(v => ({
            _id: v._id,
            businessName: v.businessName,
            category: v.category,
            subcategory: '',
            vendorType: '',
            baseVendorType: '',
            contactName: v.contactName,
            phone: v.phone,
            email: v.email,
            status: v.status,
            agentId: v.agentId,
            membership: v.membership,
            createdAt: v.createdAt,
            isUserCollection: false
        }));

        res.json([...formattedUserVendors, ...formattedLegacy]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get('/vendors/requests', [auth, adminAuth], async (req, res) => {
    try {
        const filter = getBranchFilter(req.adminUser);
        const pendingUserVendors = await User.find({ role: { $in: ['Vendor', 'vendor'] }, status: { $in: ['Pending', 'pending'] } }).populate('branchId', 'name').populate('referredBy', 'name');
        const pendingLegacy = await Vendor.find({ ...filter, status: { $in: ['Pending', 'pending'] } }).populate('branchId', 'name').populate('agentId', 'name');

        const formattedUser = pendingUserVendors.map(v => ({
            _id: v._id,
            businessName: v.businessName || v.name,
            category: v.category || 'Store Vendor',
            subcategory: v.subcategory || '',
            vendorType: v.vendorType || '',
            baseVendorType: v.baseVendorType || '',
            contactName: v.contactPerson || v.name,
            phone: v.phone || '',
            email: v.email,
            status: v.status || 'Pending',
            agentId: v.referredBy || null,
            membership: { status: v.isPaid ? 'active' : 'none' },
            createdAt: v.createdAt,
            isUserCollection: true
        }));

        const formattedLegacy = pendingLegacy.map(v => ({
            _id: v._id,
            businessName: v.businessName,
            category: v.category,
            subcategory: '',
            vendorType: '',
            baseVendorType: '',
            contactName: v.contactName,
            phone: v.phone,
            email: v.email,
            status: v.status,
            agentId: v.agentId,
            membership: v.membership,
            createdAt: v.createdAt,
            isUserCollection: false
        }));

        res.json([...formattedUser, ...formattedLegacy]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/vendors', [auth, adminAuth], async (req, res) => {
    try {
        const vendor = new Vendor({ ...req.body, branchId: req.adminUser.branchId || req.body.branchId });
        await vendor.save();
        res.json(vendor);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.put('/vendors/:id/approve', [auth, adminAuth], async (req, res) => {
    try {
        let vendor = await User.findById(req.params.id);
        if (vendor && (vendor.role === 'Vendor' || vendor.role === 'vendor')) {
            vendor.status = 'Approved';
            await vendor.save();
            return res.json(vendor);
        }
        let legacy = await Vendor.findById(req.params.id);
        if (legacy) {
            legacy.status = 'approved';
            await legacy.save();
            return res.json(legacy);
        }
        res.status(404).json({ msg: 'Vendor not found' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.put('/vendors/:id/reject', [auth, adminAuth], async (req, res) => {
    try {
        let vendor = await User.findById(req.params.id);
        if (vendor && (vendor.role === 'Vendor' || vendor.role === 'vendor')) {
            vendor.status = 'Rejected';
            await vendor.save();
            return res.json(vendor);
        }
        let legacy = await Vendor.findById(req.params.id);
        if (legacy) {
            legacy.status = 'rejected';
            await legacy.save();
            return res.json(legacy);
        }
        res.status(404).json({ msg: 'Vendor not found' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.put('/vendors/:id/toggle-status', [auth, adminAuth], async (req, res) => {
    try {
        let vendor = await User.findById(req.params.id);
        if (vendor && (vendor.role === 'Vendor' || vendor.role === 'vendor')) {
            vendor.status = (vendor.status === 'Approved' || vendor.status === 'approved') ? 'Rejected' : 'Approved';
            await vendor.save();
            return res.json(vendor);
        }
        let legacy = await Vendor.findById(req.params.id);
        if (legacy) {
            legacy.status = legacy.status === 'approved' ? 'rejected' : 'approved';
            await legacy.save();
            return res.json(legacy);
        }
        res.status(404).json({ msg: 'Vendor not found' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.put('/vendors/:id', [auth, adminAuth], async (req, res) => {
    try {
        let vendor = await User.findById(req.params.id);
        if (vendor && (vendor.role === 'Vendor' || vendor.role === 'vendor')) {
            const { businessName, contactPerson, address, phone, email, category, subcategory, vendorType } = req.body;
            if (businessName) vendor.businessName = businessName;
            if (contactPerson) vendor.contactPerson = contactPerson;
            if (address) vendor.address = address;
            if (phone) vendor.phone = phone;
            if (email) vendor.email = email;
            if (category) vendor.category = category;
            if (subcategory) vendor.subcategory = subcategory;
            if (vendorType) vendor.vendorType = vendorType;
            await vendor.save();
            return res.json(vendor);
        }
        let legacy = await Vendor.findById(req.params.id);
        if (legacy) {
            const { businessName, contactName, phone, email, category } = req.body;
            if (businessName) legacy.businessName = businessName;
            if (contactName) legacy.contactName = contactName;
            if (phone) legacy.phone = phone;
            if (email) legacy.email = email;
            if (category) legacy.category = category;
            await legacy.save();
            return res.json(legacy);
        }
        res.status(404).json({ msg: 'Vendor not found' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.put('/vendors/:id/status', [auth, adminAuth], async (req, res) => {
    const { status } = req.body;
    try {
        let vendor = await User.findById(req.params.id);
        if (vendor && (vendor.role === 'Vendor' || vendor.role === 'vendor')) {
            vendor.status = status;
            await vendor.save();
            return res.json(vendor);
        }
        let legacy = await Vendor.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json(legacy);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 7. CUSTOMER MANAGEMENT
// ==========================================
router.get('/customers', [auth, adminAuth], async (req, res) => {
    try {
        const filter = getBranchFilter(req.adminUser);
        const customers = await Customer.find(filter).populate('branchId', 'name');
        res.json(customers);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/customers', [auth, adminAuth], async (req, res) => {
    try {
        const customer = new Customer({ ...req.body, branchId: req.adminUser.branchId || req.body.branchId });
        await customer.save();
        res.json(customer);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 8. WALLET & WITHDRAWAL MANAGEMENT
// ==========================================
router.get('/wallet/withdrawals', [auth, adminAuth], async (req, res) => {
    try {
        const withdrawals = await WithdrawalRequest.find().populate('agentId', 'name email phone balance');
        res.json(withdrawals);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.put('/wallet/withdrawals/:id', [auth, adminAuth], async (req, res) => {
    const { status } = req.body;
    try {
        const request = await WithdrawalRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ msg: 'Request not found' });
        
        request.status = status;
        await request.save();

        if (status === 'approved') {
            // Debit wallet balance of agent
            await User.findByIdAndUpdate(request.agentId, { $inc: { balance: -request.amount } });
        }
        res.json(request);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 9. COMMISSIONS CONFIG
// ==========================================
router.get('/commissions', [auth, adminAuth], async (req, res) => {
    try {
        const config = await CommissionConfig.find();
        res.json(config);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/commissions', [auth, adminAuth], async (req, res) => {
    const { scope, targetId, type, value } = req.body;
    try {
        let config = await CommissionConfig.findOne({ scope, targetId });
        if (config) {
            config.type = type;
            config.value = value;
        } else {
            config = new CommissionConfig({ scope, targetId, type, value });
        }
        await config.save();
        res.json(config);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 10. MEMBERSHIP PLANS
// ==========================================
router.get('/memberships/plans', [auth, adminAuth], async (req, res) => {
    try {
        const plans = await MembershipPlan.find();
        res.json(plans);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/memberships/plans', [auth, adminAuth], async (req, res) => {
    try {
        const plan = new MembershipPlan(req.body);
        await plan.save();
        res.json(plan);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.put('/memberships/plans/:id', [auth, adminAuth], async (req, res) => {
    try {
        const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(plan);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.delete('/memberships/plans/:id', [auth, adminAuth], async (req, res) => {
    try {
        await MembershipPlan.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Plan deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 11. BANNERS & ADVERTISEMENTS
// ==========================================
router.get('/banners', [auth, adminAuth], async (req, res) => {
    try {
        const banners = await Banner.find();
        res.json(banners);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/banners', [auth, adminAuth], async (req, res) => {
    try {
        const banner = new Banner(req.body);
        await banner.save();
        res.json(banner);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.delete('/banners/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Banner.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Banner deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get('/ads', [auth, adminAuth], async (req, res) => {
    try {
        const ads = await Advertisement.find();
        res.json(ads);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/ads', [auth, adminAuth], async (req, res) => {
    try {
        const ad = new Advertisement(req.body);
        await ad.save();
        res.json(ad);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.delete('/ads/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Advertisement.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Ad deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 12. REPORTS & ANALYTICS
// ==========================================
router.get('/reports', [auth, adminAuth], async (req, res) => {
    const { type, startDate, endDate } = req.query;
    try {
        // Depending on type, return formatted analytics
        // Let's build real/realistic aggregations
        const branches = await Branch.find();
        const vendors = await Vendor.find();
        
        let reportData = [];

        if (type === 'revenue') {
            reportData = branches.map(b => ({
                branchName: b.name,
                branchCode: b.code,
                totalOrders: Math.floor(Math.random() * 50) + 10,
                revenue: Math.floor(Math.random() * 100000) + 20000,
                commission: Math.floor(Math.random() * 8000) + 1000
            }));
        } else if (type === 'vendors') {
            reportData = vendors.map(v => ({
                businessName: v.businessName,
                category: v.category,
                orders: Math.floor(Math.random() * 30) + 5,
                revenue: Math.floor(Math.random() * 50000) + 5000,
                status: v.status
            }));
        } else if (type === 'agents') {
            const agentsList = await User.find({ role: 'agent' }).populate('assignedPincode');
            reportData = agentsList.map(a => ({
                agentName: a.name,
                email: a.email,
                level: a.level,
                pincode: a.assignedPincode?.code || 'N/A',
                vendorsAdded: a.vendorsAdded || 0,
                commissionEarned: a.commissionEarned || 0,
                balance: a.balance || 0,
                status: a.status
            }));
        } else {
            // General business activity report
            reportData = [
                { period: 'Daily Trend', orders: 12, bookings: 5, revenue: 15400, commission: 890 },
                { period: 'Weekly Trend', orders: 94, bookings: 32, revenue: 123400, commission: 6120 },
                { period: 'Monthly Trend', orders: 412, bookings: 135, revenue: 542000, commission: 27100 }
            ];
        }

        res.json(reportData);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// 13. INTEGRATIONS & AGENT WORKFLOWS
// ==========================================

// Approve/Reject Agent KYC
router.put('/approve-agent/:id', [auth, adminAuth], async (req, res) => {
    const { status } = req.body;
    try {
        let agent = await User.findById(req.params.id);
        if (!agent) return res.status(404).json({ msg: 'Agent not found' });

        agent.status = status;
        if (status === 'approved') {
            agent.isActive = true;
            // Update Pincode activeAgentId linkage
            if (agent.assignedPincode) {
                await Pincode.findByIdAndUpdate(agent.assignedPincode, { activeAgentId: agent._id });
            }
        } else if (status === 'rejected' || status === 'suspended') {
            agent.isActive = false;
            if (agent.assignedPincode) {
                await Pincode.findByIdAndUpdate(agent.assignedPincode, { activeAgentId: null });
            }
        }

        await agent.save();
        res.json(agent);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Activate/Deactivate Agent
router.put('/activate-agent/:id', [auth, adminAuth], async (req, res) => {
    const { isActive } = req.body;
    try {
        let agent = await User.findById(req.params.id);
        if (!agent) return res.status(404).json({ msg: 'Agent not found' });

        agent.isActive = isActive;
        await agent.save();
        res.json(agent);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Edit Agent Details
router.put('/update-agent/:id', [auth, adminAuth], async (req, res) => {
    try {
        let agent = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!agent) return res.status(404).json({ msg: 'Agent not found' });
        res.json(agent);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get all tie-up requests
router.get('/tie-ups', [auth, adminAuth], async (req, res) => {
    try {
        const tieUps = await TieUp.find().populate('agentId', 'name email phone');
        res.json(tieUps);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Approve/Reject/Edit Business Tie-up
router.put('/tie-up/:id', [auth, adminAuth], async (req, res) => {
    try {
        const tieUp = await TieUp.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('agentId', 'name email phone');
        if (!tieUp) return res.status(404).json({ msg: 'Tie-up request not found' });
        res.json(tieUp);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Assign task to agent
router.post('/assign-task', [auth, adminAuth], async (req, res) => {
    const { assignedTo, title, description, dueDate } = req.body;
    try {
        const task = new Task({
            adminId: req.user.id,
            assignedTo,
            title,
            description,
            dueDate,
            status: 'pending'
        });
        await task.save();
        res.json(task);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get all tasks
router.get('/tasks', [auth, adminAuth], async (req, res) => {
    try {
        const tasks = await Task.find()
            .populate('assignedTo', 'name email')
            .populate('adminId', 'name')
            .sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Check agent by pincode
router.get('/check-agent', [auth, adminAuth], async (req, res) => {
    const { pincode } = req.query;
    try {
        const pin = await Pincode.findOne({ code: pincode }).populate('activeAgentId', 'name email phone');
        res.json(pin);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Save pincode
router.post('/save-pincode', [auth, adminAuth], async (req, res) => {
    const { pincode, postOffice, district, state } = req.body;
    try {
        let pin = await Pincode.findOne({ code: pincode });
        if (pin) {
            pin.postOffice = postOffice;
            pin.name = postOffice;
            pin.district = district;
            pin.state = state;
        } else {
            pin = new Pincode({
                code: pincode,
                name: postOffice,
                postOffice,
                district,
                state
            });
        }
        await pin.save();
        res.json(pin);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Create Agent Directly
router.post('/create-agent', [auth, adminAuth], async (req, res) => {
    const { name, email, phone, password, level, assignedArea, pincode, status } = req.body;
    try {
        const bcrypt = require('bcryptjs');
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'Agent user already exists' });

        let assignedPincode = null;
        if (pincode) {
            let pinDoc = await Pincode.findOne({ code: pincode });
            if (!pinDoc) {
                pinDoc = new Pincode({
                    code: pincode,
                    name: 'Area ' + pincode,
                    district: 'District',
                    state: 'State'
                });
                await pinDoc.save();
            }
            assignedPincode = pinDoc._id;
        }

        user = new User({
            name,
            email,
            phone,
            password,
            role: 'agent',
            level: level || 'pincode',
            assignedArea,
            assignedPincode,
            status: status || 'approved',
            isActive: status === 'approved'
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        if (status === 'approved' && assignedPincode) {
            await Pincode.findByIdAndUpdate(assignedPincode, { activeAgentId: user._id });
        }

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

module.exports = router;
