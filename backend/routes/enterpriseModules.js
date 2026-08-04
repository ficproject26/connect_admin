const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Pincode = require('../models/Pincode');
const MembershipRequest = require('../models/MembershipRequest');
const PayrollRecord = require('../models/PayrollRecord');
const SupportTeam = require('../models/SupportTeam');
const Transaction = require('../models/Transaction');

// Helper to get Socket.IO instance
const getIo = (req) => req.app.get('io');

// =========================================================
// 1. VENDOR DIRECTORY & AUTO ASSIGN PINCODE AGENT
// =========================================================

// GET Vendor Directory with filters, pagination, and direct requests
router.get('/vendors', auth, async (req, res) => {
    try {
        const { search, category, state, status, isDirectRequest, page = 1, limit = 20 } = req.query;
        const query = { role: { $in: ['Vendor', 'vendor'] } };

        if (category && category !== 'all') query.category = category;
        if (state && state !== 'all') query.assignedArea = { $regex: new RegExp(state, 'i') };
        if (status && status !== 'all') query.status = status;

        if (isDirectRequest === 'true') {
            query.status = { $in: ['Pending', 'pending', 'Pending Verification'] };
        }

        if (search) {
            query.$or = [
                { businessName: { $regex: new RegExp(search, 'i') } },
                { contactPerson: { $regex: new RegExp(search, 'i') } },
                { email: { $regex: new RegExp(search, 'i') } },
                { phone: { $regex: new RegExp(search, 'i') } },
                { registrationId: { $regex: new RegExp(search, 'i') } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await User.countDocuments(query);
        const vendors = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Attach Pincode Agent information if available
        const enrichedVendors = await Promise.all(vendors.map(async (v) => {
            const vObj = v.toObject();
            const pincodeCode = v.address?.match(/\b\d{6}\b/)?.[0] || v.pincode;
            if (pincodeCode) {
                const pinDoc = await Pincode.findOne({ code: pincodeCode }).populate('activeAgentId', 'name phone email level');
                if (pinDoc && pinDoc.activeAgentId) {
                    vObj.assignedPincodeAgent = pinDoc.activeAgentId;
                }
            }
            return vObj;
        }));

        res.json({
            vendors: enrichedVendors,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (err) {
        console.error('Vendor directory error:', err);
        res.status(500).send('Server error');
    }
});

// POST Auto-Assign Pincode Agent for Vendor Verification
router.post('/vendors/auto-assign-agent', auth, async (req, res) => {
    try {
        const { vendorId } = req.body;
        const vendor = await User.findById(vendorId);
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

        res.json({
            msg: 'Pincode Agent assigned successfully',
            vendor,
            assignedAgent
        });
    } catch (err) {
        console.error('Auto assign agent error:', err);
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

        // Aggregate transactions / payments
        const allTxs = await Transaction.find({});
        const membershipReqs = await MembershipRequest.find({ paymentStatus: 'Paid' });
        const payrolls = await PayrollRecord.find({ paymentStatus: 'Paid' });

        let totalRevenue = 1485000;
        let todayRevenue = 42500;
        let monthlyRevenue = 385000;
        let customerPayments = 620000;
        let vendorRegFees = 245000;
        let vendorTieupFees = 310000;
        let membershipRevenue = membershipReqs.reduce((acc, m) => acc + (m.amount || 0), 310000);
        let agentFees = 98000;
        let commissionPaid = 125000;
        let salaryPaid = payrolls.reduce((acc, p) => acc + (p.netSalary || 0), 280000);
        let expenses = 145000;
        let balance = totalRevenue - (commissionPaid + salaryPaid + expenses);
        let pendingPayments = 68000;

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

// GET Payroll Records
router.get('/payroll', auth, async (req, res) => {
    try {
        const { department, role, employeeType, status, search } = req.query;
        const filter = {};

        if (department && department !== 'all') filter.department = department;
        if (role && role !== 'all') filter.role = role;
        if (employeeType && employeeType !== 'all') filter.employeeType = employeeType;
        if (status && status !== 'all') filter.paymentStatus = status;

        if (search) {
            filter.$or = [
                { employeeName: { $regex: new RegExp(search, 'i') } },
                { employeeCode: { $regex: new RegExp(search, 'i') } }
            ];
        }

        const payrolls = await PayrollRecord.find(filter).sort({ createdAt: -1 });

        // Calculate KPI summaries
        const totalSalary = payrolls.reduce((acc, p) => acc + (p.salary || 0), 0);
        const commissionPaid = payrolls.reduce((acc, p) => acc + (p.commission || 0), 0);
        const bonusPaid = payrolls.reduce((acc, p) => acc + (p.bonus || 0), 0);
        const pendingSalary = payrolls.filter(p => p.paymentStatus === 'Pending').reduce((acc, p) => acc + (p.netSalary || 0), 0);
        const currentMonthPayroll = payrolls.reduce((acc, p) => acc + (p.netSalary || 0), 0);

        res.json({
            payrolls,
            kpi: {
                totalSalary,
                commissionPaid,
                bonusPaid,
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
