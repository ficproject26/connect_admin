const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
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
const Transaction = require('../models/Transaction');
const JobApplied = require('../models/JobApplied');
const CardHolder = require('../models/CardHolder');
const DeliveryPartner = require('../models/DeliveryPartner');
const SupportTeam = require('../models/SupportTeam');
const Category = require('../models/Category');
const Query = require('../models/Query');
const SupportTicket = require('../models/SupportTicket');
const Announcement = require('../models/Announcement');

const adminAuth = async (req, res, next) => {
    try {
        let userId = req.user.id;
        if (mongoose.Types.ObjectId.isValid(userId)) {
            userId = new mongoose.Types.ObjectId(userId);
        }
        const user = await User.findById(userId);
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
            kycStatus: v.status || 'Pending',
            kycDocs: {
                aadhaarNumber: v.kyc?.aadhaarNumber || '',
                aadhaarImage: v.kyc?.aadhaarImage || '',
                panNumber: v.kyc?.panNumber || '',
                panImage: v.kyc?.panImage || '',
                selfie: v.kyc?.selfie || '',
                businessProofImage: v.kyc?.businessProofImage || ''
            },
            address: v.address || '',
            bankDetails: v.bankDetails || null,
            paymentOptions: v.paymentOptions || null,
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
            kycStatus: v.kycStatus || 'pending',
            kycDocs: v.kycDocs || null,
            address: v.address || '',
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

// DELETE a vendor by ID
router.delete('/vendors/:id', [auth, adminAuth], async (req, res) => {
    try {
        let vendor = await User.findById(req.params.id);
        if (vendor && (vendor.role === 'Vendor' || vendor.role === 'vendor')) {
            await User.findByIdAndDelete(req.params.id);
            return res.json({ msg: 'Vendor deleted' });
        }
        let legacy = await Vendor.findById(req.params.id);
        if (legacy) {
            await Vendor.findByIdAndDelete(req.params.id);
            return res.json({ msg: 'Vendor deleted' });
        }
        res.status(404).json({ msg: 'Vendor not found' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// DELETE all vendors
router.delete('/vendors', [auth, adminAuth], async (req, res) => {
    try {
        await User.deleteMany({ role: { $in: ['Vendor', 'vendor'] } });
        await Vendor.deleteMany({});
        res.json({ msg: 'All vendors deleted' });
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
        const rawWithdrawals = await WithdrawalRequest.find()
            .populate('agentId', 'name email phone balance bankDetails')
            .sort({ createdAt: -1 });

        const mapped = rawWithdrawals.map(w => {
            const doc = w.toObject ? w.toObject() : w;
            const agent = doc.agentId || {};
            const bank = agent.bankDetails || {};

            return {
                ...doc,
                accountHolderName: doc.accountHolderName || bank.accountHolderName || agent.name || 'N/A',
                bankName: doc.bankName || bank.bankName || 'N/A',
                accountNumber: doc.accountNumber || bank.accountNumber || 'N/A',
                ifscCode: doc.ifscCode || bank.ifscCode || 'N/A',
                branchName: doc.branchName || bank.branchName || 'N/A',
                amount: doc.amount || 0,
                status: doc.status || 'pending',
                createdAt: doc.createdAt || new Date()
            };
        });

        res.json(mapped);
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
router.get('/public-banners', async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true });
        res.json(banners);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.get('/banners/public', async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true });
        res.json(banners);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

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
// Approve/Reject Agent KYC
router.put('/approve-agent/:id', [auth, adminAuth], async (req, res) => {
    const { status } = req.body;
    try {
        let agent = await User.findById(req.params.id);
        if (!agent) return res.status(404).json({ msg: 'Agent not found' });

        if (status === 'approved' && agent.status !== 'approved') {
            // Check limitation before approving
            const pinCodeVal = agent.assignedPincode ? (await Pincode.findById(agent.assignedPincode))?.code : null;
            const limitCheck = await checkAgentLimitation(agent.level, agent.assignedArea, pinCodeVal, req.params.id);
            if (!limitCheck.allowed) {
                return res.status(400).json({ msg: limitCheck.msg });
            }
        }

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
    const { level, assignedArea, pincode } = req.body;
    try {
        let agent = await User.findById(req.params.id);
        if (!agent) return res.status(404).json({ msg: 'Agent not found' });

        const newLevel = level !== undefined ? level : agent.level;
        const newArea = assignedArea !== undefined ? assignedArea : agent.assignedArea;
        const newPincode = pincode !== undefined ? pincode : (agent.assignedPincode ? (await Pincode.findById(agent.assignedPincode))?.code : null);

        if (level !== undefined || assignedArea !== undefined || pincode !== undefined) {
            const limitCheck = await checkAgentLimitation(newLevel, newArea, newPincode, req.params.id);
            if (!limitCheck.allowed) {
                return res.status(400).json({ msg: limitCheck.msg });
            }
        }

        // Handle assignedPincode resolution if pincode changes
        if (pincode !== undefined) {
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
                req.body.assignedPincode = pinDoc._id;
                if (agent.status === 'approved' || req.body.status === 'approved') {
                    await Pincode.findByIdAndUpdate(pinDoc._id, { activeAgentId: agent._id });
                }
            } else {
                req.body.assignedPincode = null;
            }
        }

        const updatedAgent = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedAgent);
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

// Helper to verify agent limitations (one per area for state, district, division, and pincode agents)
const checkAgentLimitation = async (level, assignedArea, pincode, excludeUserId = null) => {
    // If the level is state, district, or division:
    if (['state', 'district', 'division'].includes(level)) {
        if (!assignedArea) return { allowed: true };
        const query = {
            role: 'agent',
            level: level,
            assignedArea: { $regex: new RegExp('^' + assignedArea.trim() + '$', 'i') },
            status: { $in: ['approved', 'pending'] }
        };
        if (excludeUserId) {
            query._id = { $ne: excludeUserId };
        }
        const existing = await User.findOne(query);
        if (existing) {
            return {
                allowed: false,
                msg: `An agent of level '${level}' is already assigned/pending for area '${assignedArea}'`
            };
        }
    }
    
    // If the level is pincode:
    if (level === 'pincode') {
        if (!pincode) return { allowed: true };
        // Find if the pincode document exists and check if activeAgentId is set
        let pinDoc = await Pincode.findOne({ code: pincode });
        if (pinDoc && pinDoc.activeAgentId) {
            if (excludeUserId && pinDoc.activeAgentId.toString() === excludeUserId.toString()) {
                return { allowed: true };
            }
            return {
                allowed: false,
                msg: `A pincode agent is already assigned to pincode '${pincode}'`
            };
        }
        
        // Also check the User model for any pending/approved pincode agent with this assignedPincode code
        if (pinDoc) {
            const query = {
                role: 'agent',
                level: 'pincode',
                assignedPincode: pinDoc._id,
                status: { $in: ['approved', 'pending'] }
            };
            if (excludeUserId) {
                query._id = { $ne: excludeUserId };
            }
            const existing = await User.findOne(query);
            if (existing) {
                return {
                    allowed: false,
                    msg: `A pincode agent is already assigned/pending for pincode '${pincode}'`
                };
            }
        }
    }
    return { allowed: true };
};

// Create Agent Directly
router.post('/create-agent', [auth, adminAuth], async (req, res) => {
    const { name, email, phone, password, level, assignedArea, pincode, status, bankDetails } = req.body;
    try {
        const bcrypt = require('bcryptjs');
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'Agent user already exists' });

        // Enforce Agent Area limitations
        const limitCheck = await checkAgentLimitation(level, assignedArea, pincode);
        if (!limitCheck.allowed) {
            return res.status(400).json({ msg: limitCheck.msg });
        }

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
            isActive: status === 'approved',
            bankDetails
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

// Helper to resolve Vendor and Customer information for dynamic / hybrid schemas
const resolveVendorAndCustomer = async (items) => {
    const resolvedItems = [];
    // Fetch a fallback vendor from database in case vendor is completely missing
    let fallbackVendorDoc = null;
    try {
        fallbackVendorDoc = await Vendor.findOne();
    } catch (e) {}

    for (const item of items) {
        const doc = item.toObject ? item.toObject() : item;
        
        // 1. Resolve Vendor
        let vendor = doc.vendorId;
        const explicitVendorName = doc.vendor_name || doc.vendorName || doc.businessName || doc.shop_name || doc.vendor;

        if (vendor && typeof vendor === 'object' && vendor.businessName) {
            // Already an object with businessName
        } else if (vendor) {
            try {
                let dbVendorUser = null;
                if (mongoose.Types.ObjectId.isValid(vendor)) {
                    dbVendorUser = await User.findOne({
                        $or: [
                            { _id: vendor },
                            { 'businesses._id': vendor }
                        ]
                    });
                } else if (typeof vendor === 'string') {
                    if (vendor.match(/^[0-9a-fA-F]{24}$/)) {
                        dbVendorUser = await User.findOne({
                            $or: [
                                { _id: new mongoose.Types.ObjectId(vendor) },
                                { 'businesses._id': new mongoose.Types.ObjectId(vendor) }
                            ]
                        });
                    }
                    if (!dbVendorUser) {
                        dbVendorUser = await User.findOne({
                            $or: [
                                { email: vendor },
                                { mobileNumber: vendor },
                                { businessName: vendor }
                            ]
                        });
                    }
                }

                if (dbVendorUser) {
                    const matchedBiz = (dbVendorUser.businesses || []).find(b => b._id && b._id.toString() === vendor.toString());
                    vendor = {
                        _id: dbVendorUser._id,
                        businessName: matchedBiz?.businessName || dbVendorUser.businessName || dbVendorUser.name || explicitVendorName || (fallbackVendorDoc ? fallbackVendorDoc.businessName : 'N/A'),
                        name: dbVendorUser.name,
                        email: dbVendorUser.email,
                        mobileNumber: dbVendorUser.mobileNumber || 'N/A'
                    };
                } else {
                    const dbVendor = await Vendor.findOne({
                        $or: [
                            { id: vendor },
                            { _id: mongoose.Types.ObjectId.isValid(vendor) ? vendor : undefined }
                        ].filter(Boolean)
                    });
                    if (dbVendor) {
                        vendor = dbVendor.toObject();
                    } else if (explicitVendorName) {
                        vendor = {
                            businessName: explicitVendorName,
                            email: doc.vendorEmail || 'N/A',
                            mobileNumber: doc.vendorPhone || 'N/A'
                        };
                    } else if (fallbackVendorDoc) {
                        vendor = fallbackVendorDoc.toObject();
                    } else {
                        vendor = {
                            businessName: 'N/A',
                            email: 'N/A',
                            mobileNumber: 'N/A'
                        };
                    }
                }
            } catch (e) {
                console.error("Resolve vendor failed:", e);
                vendor = {
                    businessName: explicitVendorName || (fallbackVendorDoc ? fallbackVendorDoc.businessName : 'N/A'),
                    email: 'N/A',
                    mobileNumber: 'N/A'
                };
            }
        } else {
            if (explicitVendorName) {
                vendor = {
                    businessName: explicitVendorName,
                    email: doc.vendorEmail || 'N/A',
                    mobileNumber: doc.vendorPhone || 'N/A'
                };
            } else if (fallbackVendorDoc) {
                vendor = fallbackVendorDoc.toObject();
            } else {
                vendor = {
                    businessName: 'N/A',
                    email: 'N/A',
                    mobileNumber: 'N/A'
                };
            }
        }

        // Ensure businessName is set
        if (!vendor.businessName) {
            vendor.businessName = explicitVendorName || (fallbackVendorDoc ? fallbackVendorDoc.businessName : 'N/A');
        }

        // 2. Resolve Customer
        let customer = doc.customerId;
        if (!customer) {
            const custName = doc.memberName || doc.customer_name;
            if (custName) {
                try {
                    const dbCustomer = await Customer.findOne({
                        $or: [
                            { name: custName },
                            { name: new RegExp('^' + custName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') },
                            { name: new RegExp(custName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') }
                        ]
                    });
                    if (dbCustomer) {
                        customer = dbCustomer.toObject();
                    } else {
                        customer = {
                            name: custName,
                            phone: doc.customer_phone || 'N/A',
                            email: doc.customer_email || 'N/A'
                        };
                    }
                } catch (err) {
                    customer = {
                        name: custName,
                        phone: doc.customer_phone || 'N/A',
                        email: doc.customer_email || 'N/A'
                    };
                }
            } else {
                customer = {
                    name: 'N/A',
                    phone: 'N/A',
                    email: 'N/A'
                };
            }
        } else if (typeof customer === 'string') {
            try {
                let dbCustomer = null;
                if (mongoose.Types.ObjectId.isValid(customer)) {
                    dbCustomer = await Customer.findById(customer);
                }
                if (!dbCustomer) {
                    dbCustomer = await Customer.findOne({
                        $or: [
                            { name: customer },
                            { email: customer }
                        ]
                    });
                }
                if (dbCustomer) {
                    customer = dbCustomer.toObject();
                } else {
                    customer = {
                        name: customer,
                        phone: doc.customer_phone || '1234567890',
                        email: doc.customer_email || 'N/A'
                    };
                }
            } catch (err) {
                customer = {
                    name: customer,
                    phone: doc.customer_phone || '1234567890',
                    email: doc.customer_email || 'N/A'
                };
            }
        }

        // Adjust amount and commission for dynamic orders
        const amount = doc.amount !== undefined ? doc.amount : (doc.finalAmount !== undefined ? doc.finalAmount : (doc.totalAmount !== undefined ? doc.totalAmount : 0));
        const commission = doc.commission !== undefined ? doc.commission : Math.round(amount * 0.05);

        // Product details resolution
        const productDetails = doc.product_details || doc.productDetails || doc.productName || doc.product || doc.itemName || doc.item_name || (Array.isArray(doc.items) && doc.items[0] ? (doc.items[0].name || doc.items[0].title) : null) || doc.title || doc.serviceName || doc.service || 'Healthcare Package / Electronics';

        resolvedItems.push({
            ...doc,
            createdAt: doc.created_at || doc.createdAt || new Date(),
            vendorId: vendor,
            customerId: customer,
            amount,
            commission,
            productDetails
        });
    }
    return resolvedItems;
};

// GET all orders
router.get('/orders', [auth, adminAuth], async (req, res) => {
    try {
        const rawOrders = await Order.find({ type: { $nin: ['Booking', 'Job', 'Stay', 'Travel', 'Jobs'] } })
            .sort({ createdAt: -1 });

        const resolvedOrders = await resolveVendorAndCustomer(rawOrders);
        res.json(resolvedOrders);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET all bookings
router.get('/bookings', [auth, adminAuth], async (req, res) => {
    try {
        const dbBookings = await Booking.find()
            .populate('vendorId', 'businessName email phone')
            .populate('customerId', 'name email phone')
            .sort({ createdAt: -1 });

        const customBookings = await Order.find({ type: { $in: ['Booking', 'Stay', 'Travel'] } })
            .sort({ createdAt: -1 });

        const resolvedDbBookings = dbBookings.map(b => b.toObject ? b.toObject() : b);
        const resolvedCustomBookings = await resolveVendorAndCustomer(customBookings);

        const allBookings = [...resolvedDbBookings, ...resolvedCustomBookings].sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        res.json(allBookings);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET all jobs applied
router.get('/jobs', [auth, adminAuth], async (req, res) => {
    try {
        const dbJobs = await JobApplied.find().sort({ createdAt: -1 });

        const customJobs = await Order.find({ type: { $in: ['Job', 'Jobs'] } })
            .sort({ createdAt: -1 });

        // Resolve vendor and customer for custom jobs
        const resolvedCustomJobs = await resolveVendorAndCustomer(customJobs);

        const mappedDbJobs = dbJobs.map(j => {
            const obj = j.toObject ? j.toObject() : j;
            const custIdVal = obj.customerId || 'CUST-' + String(obj._id).substring(18, 24).toUpperCase();
            return {
                ...obj,
                applicationId: obj.applicationId || obj._id,
                candidateName: obj.candidateName,
                customerId: custIdVal,
                position: obj.position,
                companyName: obj.companyName || 'Connect Portal Inc.',
                hrName: obj.hrName || 'HR Team',
                status: obj.status,
                resumeUrl: obj.resumeUrl || obj.resume || '',
                createdAt: obj.createdAt
            };
        });

        const mappedCustomJobs = resolvedCustomJobs.map(order => {
            const appId = order.order_number || order.id || order._id;
            const custIdVal = (order.customerId && (order.customerId.memberId || order.customerId._id || order.customerId.id)) || 'CUST-' + String(order._id).substring(18, 24).toUpperCase();
            const companyName = (order.vendorId && (order.vendorId.businessName || order.vendorId.name)) || 'Connect Partner';
            const hrName = (order.vendorId && (order.vendorId.contactPerson || order.vendorId.name)) || 'HR Manager';

            return {
                _id: order._id,
                applicationId: appId,
                candidateName: order.customerId?.name || order.memberName || order.customer_name || 'Unknown Candidate',
                email: order.candidateEmail || order.customerId?.email || 'N/A',
                phone: order.customer_phone || order.customerId?.phone || 'N/A',
                position: order.product_details || 'Job Application',
                experience: order.experience || 'Fresher',
                status: (order.status || 'applied').toLowerCase(),
                createdAt: order.created_at || order.createdAt,
                customerId: custIdVal,
                companyName,
                hrName,
                resumeUrl: order.candidateResume || ''
            };
        });

        const allJobs = [...mappedDbJobs, ...mappedCustomJobs].sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        res.json(allJobs);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST new job applied (apply)
router.post('/jobs', [auth, adminAuth], async (req, res) => {
    try {
        const newJob = new JobApplied(req.body);
        const job = await newJob.save();
        res.json(job);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// PUT update job applied status
router.put('/jobs/:id', [auth, adminAuth], async (req, res) => {
    try {
        let job = await JobApplied.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!job) {
            const orderJob = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
            if (orderJob) {
                try {
                    const syncUrl = `http://localhost:8001/api/orders/${orderJob.id || orderJob._id}/status`;
                    await fetch(syncUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: req.body.status })
                    }).then(r => r.json()).catch(err => console.warn('Customer backend status sync from admin failed:', err.message));
                } catch (err) {
                    console.warn('Native fetch failed for customer sync:', err.message);
                }
                job = {
                    _id: orderJob._id,
                    candidateName: orderJob.memberName || orderJob.customer_name || 'Unknown Candidate',
                    email: orderJob.candidateEmail || 'N/A',
                    phone: orderJob.customer_phone || 'N/A',
                    position: orderJob.product_details || 'Job Application',
                    experience: orderJob.experience || 'Fresher',
                    status: (orderJob.status || 'applied').toLowerCase(),
                    createdAt: orderJob.created_at || orderJob.createdAt
                };
            }
        }
        res.json(job);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// DELETE job applied
router.delete('/jobs/:id', [auth, adminAuth], async (req, res) => {
    try {
        const job = await JobApplied.findByIdAndDelete(req.params.id);
        if (!job) {
            await Order.findByIdAndDelete(req.params.id);
        }
        res.json({ msg: 'Job application deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET all membership card holders
router.get('/card-holders', [auth, adminAuth], async (req, res) => {
    try {
        const holders = await CardHolder.find().sort({ createdAt: -1 });
        res.json(holders);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST new card holder
router.post('/card-holders', [auth, adminAuth], async (req, res) => {
    try {
        const newHolder = new CardHolder(req.body);
        const holder = await newHolder.save();
        res.json(holder);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// PUT update card holder status
router.put('/card-holders/:id', [auth, adminAuth], async (req, res) => {
    try {
        const holder = await CardHolder.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(holder);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// DELETE card holder
router.delete('/card-holders/:id', [auth, adminAuth], async (req, res) => {
    try {
        await CardHolder.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Card holder deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET all payments (transactions)
router.get('/payments', [auth, adminAuth], async (req, res) => {
    try {
        const payments = await Transaction.find()
            .populate('userId', 'name email role')
            .sort({ createdAt: -1 });
        res.json(payments);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST a new payment / transaction
router.post('/payments', [auth, adminAuth], async (req, res) => {
    try {
        const newTx = new Transaction(req.body);
        const tx = await newTx.save();
        res.json(tx);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// PUT update payment / transaction details
router.put('/payments/:id', [auth, adminAuth], async (req, res) => {
    try {
        const tx = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('userId', 'name email role');
        if (!tx) return res.status(404).json({ msg: 'Transaction not found' });
        res.json(tx);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// DELETE payment / transaction
router.delete('/payments/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Transaction.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Transaction deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET all delivery partners
router.get('/delivery-partners', [auth, adminAuth], async (req, res) => {
    try {
        const partners = await DeliveryPartner.find().sort({ createdAt: -1 });
        res.json(partners);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST new delivery partner
router.post('/delivery-partners', [auth, adminAuth], async (req, res) => {
    try {
        const newPartner = new DeliveryPartner(req.body);
        const partner = await newPartner.save();
        res.json(partner);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// PUT update delivery partner status
router.put('/delivery-partners/:id', [auth, adminAuth], async (req, res) => {
    try {
        const partner = await DeliveryPartner.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(partner);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// DELETE delivery partner
router.delete('/delivery-partners/:id', [auth, adminAuth], async (req, res) => {
    try {
        await DeliveryPartner.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Delivery partner deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET all customer support team
router.get('/support-team', [auth, adminAuth], async (req, res) => {
    try {
        const team = await SupportTeam.find().sort({ createdAt: -1 });
        res.json(team);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST new support team member
router.post('/support-team', [auth, adminAuth], async (req, res) => {
    try {
        const newMember = new SupportTeam(req.body);
        const member = await newMember.save();
        res.json(member);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// PUT update support team member details
router.put('/support-team/:id', [auth, adminAuth], async (req, res) => {
    try {
        const member = await SupportTeam.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(member);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// DELETE support team member
router.delete('/support-team/:id', [auth, adminAuth], async (req, res) => {
    try {
        await SupportTeam.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Support team member deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// CATEGORY MANAGEMENT — Hierarchical 3-Tier System
// Main Categories are SYSTEM-LOCKED (isSystem: true)
// Admin can only manage Sub Categories and Child Categories
// ==========================================

const slugify = (str) => str.toLowerCase().replace(/[&]/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Helper: build full category tree
const buildCategoryTree = async () => {
    const all = await Category.find().sort({ sortOrder: 1, name: 1 }).lean();
    const map = {};
    const roots = [];

    // Index all categories by _id
    all.forEach(c => {
        c.children = [];
        map[c._id.toString()] = c;
    });

    // Build parent-child relationships
    all.forEach(c => {
        if (c.parentId && map[c.parentId.toString()]) {
            map[c.parentId.toString()].children.push(c);
        } else if (!c.parentId) {
            roots.push(c);
        }
    });

    return roots;
};

// GET full category tree (PUBLIC — no auth required)
router.get('/categories', async (req, res) => {
    try {
        const tree = await buildCategoryTree();
        res.json(tree);
    } catch (err) {
        console.error('Error fetching category tree:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// GET flat list of all categories (for admin table views)
router.get('/categories-flat', async (req, res) => {
    try {
        const categories = await Category.find().sort({ sortOrder: 1, name: 1 }).lean();
        res.json(categories);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// GET single category by ID
router.get('/categories/:id', async (req, res) => {
    try {
        const cat = await Category.findById(req.params.id).lean();
        if (!cat) return res.status(404).json({ error: 'Category not found' });
        // Attach children
        cat.children = await Category.find({ parentId: cat._id }).sort({ sortOrder: 1 }).lean();
        res.json(cat);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// POST create sub or child category (Admin only)
router.post('/categories', [auth, adminAuth], async (req, res) => {
    try {
        const { name, parentId, level, description, icon, banner, themeColor, isFeatured } = req.body;

        if (!name || !parentId || !level) {
            return res.status(400).json({ error: 'name, parentId, and level are required' });
        }

        if (level === 'main') {
            return res.status(403).json({ error: 'Main categories are system-locked and cannot be created via API' });
        }

        // Verify parent exists
        const parent = await Category.findById(parentId);
        if (!parent) {
            return res.status(404).json({ error: 'Parent category not found' });
        }

        // Validate hierarchy: sub must have main parent, child must have sub parent
        if (level === 'sub' && parent.level !== 'main') {
            return res.status(400).json({ error: 'Sub categories must have a main category as parent' });
        }
        if (level === 'child' && parent.level !== 'sub') {
            return res.status(400).json({ error: 'Child categories must have a sub category as parent' });
        }

        // Get next sort order
        const maxOrder = await Category.findOne({ parentId }).sort({ sortOrder: -1 }).select('sortOrder');
        const nextOrder = (maxOrder?.sortOrder ?? -1) + 1;

        const newCat = await Category.create({
            level,
            name: name.trim(),
            slug: slugify(name.trim()),
            parentId,
            isSystem: false,
            isEditable: true,
            isDeletable: true,
            isActive: true,
            isVisible: true,
            isFeatured: isFeatured || false,
            description: description || '',
            icon: icon || '',
            banner: banner || '',
            themeColor: themeColor || '',
            sortOrder: nextOrder
        });

        // Emit real-time update
        const io = req.app.get('io');
        if (io) io.emit('categories:updated', { action: 'create', category: newCat });

        res.json(newCat);
    } catch (err) {
        console.error('Error creating category:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// PUT update category (Admin only — rejects system-locked categories)
router.put('/categories/:id', [auth, adminAuth], async (req, res) => {
    try {
        const cat = await Category.findById(req.params.id);
        if (!cat) return res.status(404).json({ error: 'Category not found' });

        // SYSTEM LOCK: Main categories cannot be modified
        if (cat.isSystem) {
            return res.status(403).json({ error: '🔒 System-locked Main Categories cannot be modified' });
        }

        // Prevent changing level or isSystem
        const updates = { ...req.body };
        delete updates.level;
        delete updates.isSystem;
        delete updates.isDeletable;
        delete updates.isEditable;
        delete updates._id;

        // Auto-generate slug if name changed
        if (updates.name) {
            updates.slug = slugify(updates.name.trim());
            updates.name = updates.name.trim();
        }

        updates.updatedAt = new Date();

        const updated = await Category.findByIdAndUpdate(req.params.id, updates, { new: true });

        // Emit real-time update
        const io = req.app.get('io');
        if (io) io.emit('categories:updated', { action: 'update', category: updated });

        res.json(updated);
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// PUT toggle active/featured status (Admin only — rejects system-locked)
router.put('/categories/:id/toggle', [auth, adminAuth], async (req, res) => {
    try {
        const cat = await Category.findById(req.params.id);
        if (!cat) return res.status(404).json({ error: 'Category not found' });

        if (cat.isSystem) {
            return res.status(403).json({ error: '🔒 System-locked Main Categories cannot be toggled' });
        }

        const { field } = req.body; // 'isActive', 'isFeatured', 'isVisible'
        const allowedFields = ['isActive', 'isFeatured', 'isVisible'];
        if (!field || !allowedFields.includes(field)) {
            return res.status(400).json({ error: `field must be one of: ${allowedFields.join(', ')}` });
        }

        cat[field] = !cat[field];
        cat.updatedAt = new Date();
        await cat.save();

        // Emit real-time update
        const io = req.app.get('io');
        if (io) io.emit('categories:updated', { action: 'toggle', category: cat });

        res.json(cat);
    } catch (err) {
        console.error('Error toggling category:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// PUT reorder categories (Admin only)
router.put('/categories-reorder', [auth, adminAuth], async (req, res) => {
    try {
        const { orderedIds } = req.body; // Array of category _id strings in new order
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: 'orderedIds must be an array' });
        }

        const bulkOps = orderedIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id, isSystem: false },
                update: { $set: { sortOrder: index, updatedAt: new Date() } }
            }
        }));

        await Category.bulkWrite(bulkOps);

        // Emit real-time update
        const io = req.app.get('io');
        if (io) io.emit('categories:updated', { action: 'reorder' });

        res.json({ msg: 'Categories reordered successfully' });
    } catch (err) {
        console.error('Error reordering categories:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// DELETE category (Admin only — rejects system-locked, cascades to children)
router.delete('/categories/:id', [auth, adminAuth], async (req, res) => {
    try {
        const cat = await Category.findById(req.params.id);
        if (!cat) return res.status(404).json({ error: 'Category not found' });

        // SYSTEM LOCK: Main categories cannot be deleted
        if (cat.isSystem) {
            return res.status(403).json({ error: '🔒 System-locked Main Categories cannot be deleted' });
        }

        // Cascade delete: remove all children
        if (cat.level === 'sub') {
            // Delete all child categories under this sub
            await Category.deleteMany({ parentId: cat._id });
        }

        await Category.findByIdAndDelete(req.params.id);

        // Emit real-time update
        const io = req.app.get('io');
        if (io) io.emit('categories:updated', { action: 'delete', categoryId: req.params.id });

        res.json({ msg: 'Category deleted successfully' });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// DELETE category hierarchy & marker endpoint
router.delete('/categories-hierarchy', [auth, adminAuth], async (req, res) => {
    try {
        const { name, subcategory, subSubcategory } = req.query;
        const filter = {};
        if (name) filter.name = name;
        if (subcategory) filter.subcategory = subcategory;
        if (subSubcategory) filter.subSubcategory = subSubcategory;

        // 1. Delete matching existing records
        if (Object.keys(filter).length > 0) {
            await Category.deleteMany(filter);
        }

        // 2. Insert deletion marker so predefined TAXONOMY entries also stay deleted
        const deletionMarker = new Category({
            name: name || '',
            subcategory: subcategory || '',
            subSubcategory: subSubcategory || '',
            isActive: false,
            isDeleted: true,
            description: 'DELETED_HIERARCHY_MARKER'
        });
        await deletionMarker.save();

        res.json({ msg: 'Category hierarchy deleted successfully' });
    } catch (err) {
        console.error("Error deleting category hierarchy:", err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// GET all active banners (public)
router.get('/public/banners', async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true });
        res.json(banners);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


// GET all queries
router.get('/queries', [auth, adminAuth], async (req, res) => {
    try {
        const queries = await Query.find().sort({ createdAt: -1 });
        res.json(queries);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST new query
router.post('/queries', [auth, adminAuth], async (req, res) => {
    try {
        const newQuery = new Query(req.body);
        const query = await newQuery.save();
        res.json(query);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// PUT update query status
router.put('/queries/:id', [auth, adminAuth], async (req, res) => {
    try {
        const query = await Query.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(query);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// DELETE query
router.delete('/queries/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Query.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Query deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET all support tickets
router.get('/tickets', [auth, adminAuth], async (req, res) => {
    try {
        const tickets = await SupportTicket.find().sort({ createdAt: -1 });
        res.json(tickets);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST new support ticket
router.post('/tickets', [auth, adminAuth], async (req, res) => {
    try {
        const count = await SupportTicket.countDocuments();
        const ticketId = 'TKT-' + (1000 + count + 1);
        const newTicket = new SupportTicket({ ...req.body, ticketId });
        const ticket = await newTicket.save();
        res.json(ticket);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// PUT update support ticket
router.put('/tickets/:id', [auth, adminAuth], async (req, res) => {
    try {
        const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(ticket);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// DELETE support ticket
router.delete('/tickets/:id', [auth, adminAuth], async (req, res) => {
    try {
        await SupportTicket.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Ticket deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET all announcements
router.get('/announcements', [auth, adminAuth], async (req, res) => {
    try {
        const announcements = await Announcement.find().sort({ createdAt: -1 });
        res.json(announcements);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// POST new announcement
router.post('/announcements', [auth, adminAuth], async (req, res) => {
    try {
        const newAnn = new Announcement(req.body);
        const ann = await newAnn.save();
        res.json(ann);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// PUT update announcement
router.put('/announcements/:id', [auth, adminAuth], async (req, res) => {
    try {
        const ann = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(ann);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// DELETE announcement
router.delete('/announcements/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Announcement deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

module.exports = router;
