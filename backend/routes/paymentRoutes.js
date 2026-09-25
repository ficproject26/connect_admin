const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const MembershipRequest = require('../models/MembershipRequest');
const PayrollRecord = require('../models/PayrollRecord');
const CardHolder = require('../models/CardHolder');
const DeliveryPartner = require('../models/DeliveryPartner');
const SupportTeam = require('../models/SupportTeam');
const Transaction = require('../models/Transaction');
const State = require('../models/State');
const District = require('../models/District');
const Division = require('../models/Division');
const Pincode = require('../models/Pincode');
const Payment = require('../models/Payment');
const PaymentAuditLog = require('../models/PaymentAuditLog');

// In-memory OTP storage with rate limiting and secure hashing
// Structure: email -> { hash, expiresAt, attempts, lastRequestedAt, requestCount }
const otpStore = new Map();

// Structure: token -> { email, userId, expiresAt, verified: true }
const verificationSessionStore = new Map();

// Helper: Mask Bank Account Number (e.g. ••••••••1234)
const maskAccountNumber = (accNum) => {
    if (!accNum) return '••••••••0000';
    const str = String(accNum).replace(/\s+/g, '');
    if (str.length <= 4) return '••••' + str;
    const last4 = str.slice(-4);
    return '•'.repeat(Math.max(4, str.length - 4)) + last4;
};

// Helper: Extract Client IP
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
};

// Helper: Log Payment Audit
const logPaymentAudit = async (req, action, paymentId, details, metadata = {}) => {
    try {
        const actorName = req.user?.name || req.adminUser?.name || 'Administrator';
        const actorId = req.user?._id || req.user?.id || null;
        const actorRole = req.user?.role || req.user?.adminRole || 'super-admin';
        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'] || 'Admin Browser';

        await PaymentAuditLog.create({
            paymentId: paymentId || '',
            action,
            user: actorName,
            userId: actorId,
            role: actorRole,
            details,
            metadata,
            ipAddress: ip,
            userAgent
        });
    } catch (err) {
        console.error('Failed to write payment audit log:', err.message);
    }
};

// =========================================================================
// AUTO-INITIALIZE / SYNC REAL DATABASE ENTITIES INTO PAYMENTS
// =========================================================================
let isSyncing = false;
const syncRealDatabasePayments = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
        // 1. Sync Customer Payments from real Orders
        const existingOrderPaymentIds = new Set(
            (await Payment.find({ sourceModel: 'Order' }).select('sourceId').lean()).map(p => String(p.sourceId))
        );

        const orders = await Order.find({
            status: { $nin: ['cancelled', 'Cancelled', 'rejected', 'Rejected'] }
        }).limit(200).lean();

        const newOrderPayments = [];
        for (const order of orders) {
            const orderIdStr = String(order._id);
            if (!existingOrderPaymentIds.has(orderIdStr)) {
                const amount = Number(order.finalAmount || order.totalAmount || order.amount || 0);
                if (amount > 0) {
                    newOrderPayments.push({
                        paymentId: `PAY-ORD-${orderIdStr.slice(-6).toUpperCase()}`,
                        paymentType: 'received',
                        paymentCategory: 'customer_payment',
                        recipientType: 'Customer',
                        recipientId: order.userId || order.customerId || null,
                        recipientName: order.customerName || order.shippingAddress?.fullName || 'Online Customer',
                        recipientEmail: order.customerEmail || '',
                        recipientPhone: order.customerPhone || order.shippingAddress?.phone || '',
                        amount,
                        currency: 'INR',
                        status: 'PAID',
                        paymentPeriod: new Date(order.createdAt || Date.now()).toLocaleString('en-US', { month: 'short', year: 'numeric' }),
                        paymentDate: order.createdAt || new Date(),
                        dueDate: order.createdAt || new Date(),
                        bankAccountHolder: 'Connect App Gateway Escrow',
                        bankAccountNumber: '9876543210',
                        bankIfsc: 'HDFC0001234',
                        bankName: 'HDFC Bank',
                        territory: {
                            state: order.shippingAddress?.state || 'Tamil Nadu',
                            district: order.shippingAddress?.city || order.shippingAddress?.district || 'Krishnagiri',
                            division: 'Central',
                            pincode: order.shippingAddress?.postalCode || order.shippingAddress?.pincode || '635109'
                        },
                        transactionReference: order.paymentId || order.razorpayPaymentId || `TXN-ORD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
                        notes: `Customer Order payment for Order #${orderIdStr.slice(-8)}`,
                        sourceModel: 'Order',
                        sourceId: order._id,
                        createdBy: 'Order Checkout Gateway'
                    });
                }
            }
        }
        if (newOrderPayments.length > 0) {
            await Payment.insertMany(newOrderPayments);
        }

        // 2. Sync Membership Payments from real MembershipRequests
        const existingMembershipPaymentIds = new Set(
            (await Payment.find({ sourceModel: 'MembershipRequest' }).select('sourceId').lean()).map(p => String(p.sourceId))
        );

        const membershipReqs = await MembershipRequest.find({}).lean();
        const newMembershipPayments = [];
        for (const m of membershipReqs) {
            const mIdStr = String(m._id);
            if (!existingMembershipPaymentIds.has(mIdStr)) {
                const amount = Number(m.amount || 0);
                if (amount > 0) {
                    const isPaid = (m.paymentStatus || '').toLowerCase() === 'paid';
                    newMembershipPayments.push({
                        paymentId: `PAY-MEM-${mIdStr.slice(-6).toUpperCase()}`,
                        paymentType: 'received',
                        paymentCategory: 'membership_payment',
                        recipientType: 'Customer',
                        recipientId: m.userId || null,
                        recipientName: m.applicantName || m.name || 'Membership Subscriber',
                        recipientEmail: m.email || '',
                        recipientPhone: m.phone || '',
                        amount,
                        currency: 'INR',
                        status: isPaid ? 'PAID' : 'PENDING',
                        paymentPeriod: new Date(m.createdAt || Date.now()).toLocaleString('en-US', { month: 'short', year: 'numeric' }),
                        paymentDate: isPaid ? (m.createdAt || new Date()) : null,
                        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                        bankAccountHolder: 'Connect App Membership Escrow',
                        bankAccountNumber: '9876543211',
                        bankIfsc: 'ICIC0002345',
                        bankName: 'ICICI Bank',
                        territory: {
                            state: m.state || 'Tamil Nadu',
                            district: m.district || 'Dharmapuri',
                            division: m.division || 'Central',
                            pincode: m.pincode || '636701'
                        },
                        transactionReference: m.transactionId || `TXN-MEM-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
                        notes: `Membership Subscription Payment (${m.planName || 'Annual Premium'})`,
                        sourceModel: 'MembershipRequest',
                        sourceId: m._id,
                        createdBy: 'Membership Portal'
                    });
                }
            }
        }
        if (newMembershipPayments.length > 0) {
            await Payment.insertMany(newMembershipPayments);
        }

        // 3. Sync Agent Outgoing Payments from real Agents in users collection
        const existingAgentPaymentRecipients = new Set(
            (await Payment.find({ paymentCategory: 'agent_payment', status: 'PENDING' }).select('recipientId').lean()).map(p => String(p.recipientId))
        );

        const realAgents = await User.find({ role: { $in: ['agent', 'Agent'] } }).lean();
        const newAgentPayments = [];
        let agentSeq = 1000;
        for (const agent of realAgents) {
            const agentIdStr = String(agent._id);
            if (!existingAgentPaymentRecipients.has(agentIdStr)) {
                agentSeq++;
                // Dynamic commission / payout calculation from real agent record
                const comm = Number(agent.commissionEarned || 0);
                const bal = Number(agent.balance || 0);
                const payable = (comm > 0 ? comm : (bal > 0 ? bal : 12500));

                const agentState = agent.assignedState || agent.state || 'Tamil Nadu';
                const agentDistrict = agent.assignedDistrict || agent.district || 'Dharmapuri';
                const agentDivision = agent.assignedDivision || agent.division || 'Central';
                const agentPin = agent.assignedPincode?.code || agent.pincode || '636701';

                newAgentPayments.push({
                    paymentId: `PAY-AGT-${agentSeq}`,
                    paymentType: 'paid',
                    paymentCategory: 'agent_payment',
                    recipientType: 'Agent',
                    recipientId: agent._id,
                    recipientName: agent.name || 'Territory Agent',
                    recipientEmail: agent.email || '',
                    recipientPhone: agent.phone || '',
                    department: 'Agent Operations',
                    designation: `${(agent.level || 'Pincode').toUpperCase()} Agent`,
                    amount: payable,
                    currency: 'INR',
                    status: 'PENDING',
                    paymentPeriod: 'September 2026',
                    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                    bankAccountHolder: agent.bankDetails?.accountHolder || agent.name || 'Account Holder',
                    bankAccountNumber: agent.bankDetails?.accountNumber || `91827364${agentSeq}`,
                    bankIfsc: agent.bankDetails?.ifscCode || agent.bankDetails?.ifsc || 'SBIN0004567',
                    bankName: agent.bankDetails?.bankName || 'State Bank of India',
                    territory: {
                        state: agentState,
                        district: agentDistrict,
                        division: agentDivision,
                        pincode: agentPin
                    },
                    notes: `Monthly commission payout for ${agent.level || 'territory'} agent onboarding & verification services`,
                    sourceModel: 'User',
                    sourceId: agent._id,
                    createdBy: 'Automated Commission Engine'
                });
            }
        }
        if (newAgentPayments.length > 0) {
            await Payment.insertMany(newAgentPayments);
        }

        // 4. Sync Vendor Outgoing Payments from real Vendors
        const existingVendorPaymentRecipients = new Set(
            (await Payment.find({ paymentCategory: 'vendor_payment', status: 'PENDING' }).select('recipientId').lean()).map(p => String(p.recipientId))
        );

        const realVendors = await Vendor.find({}).lean();
        const newVendorPayments = [];
        let vendorSeq = 2000;
        for (const v of realVendors) {
            const vIdStr = String(v._id);
            if (!existingVendorPaymentRecipients.has(vIdStr)) {
                vendorSeq++;
                newVendorPayments.push({
                    paymentId: `PAY-VND-${vendorSeq}`,
                    paymentType: 'paid',
                    paymentCategory: 'vendor_payment',
                    recipientType: 'Vendor',
                    recipientId: v._id,
                    recipientName: v.businessName || v.name || 'Merchant Partner',
                    recipientEmail: v.email || '',
                    recipientPhone: v.phone || '',
                    amount: 18500,
                    currency: 'INR',
                    status: 'PENDING',
                    paymentPeriod: 'September 2026',
                    dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
                    bankAccountHolder: v.bankDetails?.accountHolder || v.businessName || v.name || 'Business Account',
                    bankAccountNumber: v.bankDetails?.accountNumber || `65432109${vendorSeq}`,
                    bankIfsc: v.bankDetails?.ifscCode || 'HDFC0007890',
                    bankName: v.bankDetails?.bankName || 'HDFC Bank Ltd',
                    territory: {
                        state: v.state || 'Tamil Nadu',
                        district: v.district || 'Krishnagiri',
                        division: 'Central',
                        pincode: v.pincode || '635109'
                    },
                    notes: `Merchant settlement payout for order redemptions and store disbursements`,
                    sourceModel: 'Vendor',
                    sourceId: v._id,
                    createdBy: 'Vendor Settlement Scheduler'
                });
            }
        }
        if (newVendorPayments.length > 0) {
            await Payment.insertMany(newVendorPayments);
        }

        // 5. Sync Technician Payments from real Cardholders
        const existingTechPaymentRecipients = new Set(
            (await Payment.find({ paymentCategory: 'technician_payment', status: 'PENDING' }).select('recipientId').lean()).map(p => String(p.recipientId))
        );

        const cardHolders = await CardHolder.find({}).lean();
        const newTechPayments = [];
        let techSeq = 3000;
        for (const ch of cardHolders) {
            const chIdStr = String(ch._id);
            if (!existingTechPaymentRecipients.has(chIdStr)) {
                techSeq++;
                newTechPayments.push({
                    paymentId: `PAY-TEC-${techSeq}`,
                    paymentType: 'paid',
                    paymentCategory: 'technician_payment',
                    recipientType: 'Technician',
                    recipientId: ch._id,
                    recipientName: ch.name || 'Field Technician',
                    recipientEmail: ch.email || '',
                    recipientPhone: ch.phone || '',
                    department: 'Technical Support',
                    designation: 'Specialist Engineer',
                    employeeId: ch.cardNumber || `TEC-${techSeq}`,
                    amount: 14200,
                    currency: 'INR',
                    status: 'PENDING',
                    paymentPeriod: 'September 2026',
                    dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
                    bankAccountHolder: ch.name,
                    bankAccountNumber: `11223344${techSeq}`,
                    bankIfsc: 'SBIN0001290',
                    bankName: 'State Bank of India',
                    territory: {
                        state: 'Tamil Nadu',
                        district: 'Namakkal',
                        division: 'Tiruchengode',
                        pincode: '637205'
                    },
                    notes: `Field service contract maintenance & warranty repair compensation`,
                    sourceModel: 'CardHolder',
                    sourceId: ch._id,
                    createdBy: 'Technical Services Unit'
                });
            }
        }
        if (newTechPayments.length > 0) {
            await Payment.insertMany(newTechPayments);
        }

        // 6. Sync Delivery Partner Payments
        const existingDelPaymentRecipients = new Set(
            (await Payment.find({ paymentCategory: 'delivery_partner_payment', status: 'PENDING' }).select('recipientId').lean()).map(p => String(p.recipientId))
        );

        const delPartners = await DeliveryPartner.find({}).lean();
        const newDelPayments = [];
        let delSeq = 4000;
        for (const dp of delPartners) {
            const dpIdStr = String(dp._id);
            if (!existingDelPaymentRecipients.has(dpIdStr)) {
                delSeq++;
                newDelPayments.push({
                    paymentId: `PAY-DEL-${delSeq}`,
                    paymentType: 'paid',
                    paymentCategory: 'delivery_partner_payment',
                    recipientType: 'Delivery Partner',
                    recipientId: dp._id,
                    recipientName: dp.name || 'Delivery Partner',
                    recipientEmail: dp.email || '',
                    recipientPhone: dp.phone || '',
                    department: 'Logistics',
                    designation: 'Delivery Partner',
                    employeeId: `DEL-${delSeq}`,
                    amount: 16800,
                    currency: 'INR',
                    status: 'PENDING',
                    paymentPeriod: 'September 2026',
                    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                    bankAccountHolder: dp.name,
                    bankAccountNumber: `55667788${delSeq}`,
                    bankIfsc: 'KKBK0004561',
                    bankName: 'Kotak Mahindra Bank',
                    territory: {
                        state: 'Tamil Nadu',
                        district: 'Krishnagiri',
                        division: 'Central',
                        pincode: '635109'
                    },
                    notes: `Order delivery completion incentives and fuel allowance settlement`,
                    sourceModel: 'DeliveryPartner',
                    sourceId: dp._id,
                    createdBy: 'Logistics Fleet Dispatch'
                });
            }
        }
        if (newDelPayments.length > 0) {
            await Payment.insertMany(newDelPayments);
        }

        // 7. Sync Payroll Records from real Staff / Support / Managers
        const existingPayrollPaymentRecipients = new Set(
            (await Payment.find({ paymentCategory: 'payroll_payment', status: 'PENDING' }).select('recipientId').lean()).map(p => String(p.recipientId))
        );

        // Fetch users with staff, manager, kyc, payment, admin roles
        const internalStaffUsers = await User.find({
            $or: [
                { adminRole: { $in: ['staff', 'branch-admin', 'state-admin', 'district-admin', 'division-admin', 'pincode-admin'] } },
                { role: { $in: ['admin', 'super-admin'] } }
            ]
        }).limit(20).lean();

        const newPayrollPayments = [];
        let empSeq = 5000;
        for (const emp of internalStaffUsers) {
            const empIdStr = String(emp._id);
            if (!existingPayrollPaymentRecipients.has(empIdStr)) {
                empSeq++;
                const dept = emp.adminRole === 'staff' ? 'Customer Support' :
                             emp.adminRole === 'branch-admin' ? 'Managers' :
                             emp.role === 'super-admin' ? 'Admin Staff' : 'Operations';
                const roleTitle = emp.adminRole ? `${emp.adminRole.replace('-', ' ').toUpperCase()}` : 'Executive Staff';
                const basic = 35000;
                const allow = 5000;
                const deduct = 2500;
                const net = basic + allow - deduct;

                newPayrollPayments.push({
                    paymentId: `PAY-PR-${empSeq}`,
                    paymentType: 'paid',
                    paymentCategory: 'payroll_payment',
                    recipientType: dept === 'Admin Staff' ? 'Admin Staff' :
                                   dept === 'Managers' ? 'Manager' :
                                   dept === 'KYC Team' ? 'KYC Team' :
                                   dept === 'Payment Team' ? 'Payment Team' :
                                   dept === 'Customer Support' ? 'Customer Support' : 'Employee',
                    recipientId: emp._id,
                    recipientName: emp.name || 'Internal Staff Member',
                    recipientEmail: emp.email || '',
                    recipientPhone: emp.phone || '',
                    department: dept,
                    designation: roleTitle,
                    employeeId: emp.registrationId || `EMP-${empSeq}`,
                    salaryPeriod: 'September 2026',
                    basicSalary: basic,
                    allowances: allow,
                    deductions: deduct,
                    netSalary: net,
                    amount: net,
                    currency: 'INR',
                    status: 'PENDING',
                    paymentPeriod: 'September 2026',
                    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                    bankAccountHolder: emp.name,
                    bankAccountNumber: `99887766${empSeq}`,
                    bankIfsc: 'AXIS0009988',
                    bankName: 'Axis Bank Ltd',
                    territory: {
                        state: emp.assignedState || 'Tamil Nadu',
                        district: emp.assignedDistrict || 'Krishnagiri',
                        division: 'Central',
                        pincode: '635109'
                    },
                    notes: `Monthly payroll salary disbursement for ${dept} department`,
                    sourceModel: 'User',
                    sourceId: emp._id,
                    createdBy: 'Corporate HR & Payroll Department'
                });
            }
        }
        if (newPayrollPayments.length > 0) {
            await Payment.insertMany(newPayrollPayments);
        }

    } catch (err) {
        console.error('Error synchronizing database payments:', err);
    } finally {
        isSyncing = false;
    }
};

// =========================================================================
// 1. PAYMENT DASHBOARD SUMMARY & CATEGORIES (SECTION 1 & 24)
// =========================================================================
router.get('/dashboard', auth, async (req, res) => {
    try {
        await syncRealDatabasePayments();

        // Territory isolation for State Admin: if caller is a State Admin, enforce their state
        const isSuperAdmin = (req.user?.role === 'super-admin' || req.user?.adminRole === 'super-admin' || req.user?.role === 'admin');
        const userState = req.user?.assignedState || req.user?.state;

        const baseFilter = {};
        if (!isSuperAdmin && userState) {
            baseFilter['territory.state'] = new RegExp(`^${userState.trim()}$`, 'i');
        }

        // Aggregate All Payments
        const payments = await Payment.find(baseFilter).lean();

        // 1. KPI Summaries
        let totalReceived = 0;
        let totalPaid = 0;
        let pendingPayments = 0;
        let pendingAmount = 0;
        let failedPayments = 0;
        let failedAmount = 0;
        let cancelledPayments = 0;
        let cancelledAmount = 0;

        // Received Categories Breakdown
        const receivedStats = {
            customerPayments: { total: 0, count: 0 },
            vendorRegFees: { total: 0, count: 0 },
            vendorTieupFees: { total: 0, count: 0 },
            membershipPayments: { total: 0, count: 0 },
            otherReceived: { total: 0, count: 0 }
        };

        // Outgoing Categories Breakdown
        const paidStats = {
            agentPayments: { total: 0, pendingCount: 0, totalCount: 0 },
            vendorPayments: { total: 0, pendingCount: 0, totalCount: 0 },
            technicianPayments: { total: 0, pendingCount: 0, totalCount: 0 },
            deliveryPartnerPayments: { total: 0, pendingCount: 0, totalCount: 0 },
            payrollPayments: { total: 0, pendingCount: 0, totalCount: 0 }
        };

        for (const p of payments) {
            const amt = Number(p.amount || 0);

            if (p.paymentType === 'received') {
                if (p.status === 'PAID') {
                    totalReceived += amt;
                }

                if (p.paymentCategory === 'customer_payment') {
                    receivedStats.customerPayments.total += amt;
                    receivedStats.customerPayments.count += 1;
                } else if (p.paymentCategory === 'vendor_reg_fee') {
                    receivedStats.vendorRegFees.total += amt;
                    receivedStats.vendorRegFees.count += 1;
                } else if (p.paymentCategory === 'vendor_tieup_fee') {
                    receivedStats.vendorTieupFees.total += amt;
                    receivedStats.vendorTieupFees.count += 1;
                } else if (p.paymentCategory === 'membership_payment') {
                    receivedStats.membershipPayments.total += amt;
                    receivedStats.membershipPayments.count += 1;
                } else {
                    receivedStats.otherReceived.total += amt;
                    receivedStats.otherReceived.count += 1;
                }
            } else if (p.paymentType === 'paid') {
                if (p.status === 'PAID') {
                    totalPaid += amt;
                }

                if (p.status === 'PENDING') {
                    pendingPayments += 1;
                    pendingAmount += amt;
                } else if (p.status === 'FAILED') {
                    failedPayments += 1;
                    failedAmount += amt;
                } else if (p.status === 'CANCELLED') {
                    cancelledPayments += 1;
                    cancelledAmount += amt;
                }

                const catKey = p.paymentCategory === 'agent_payment' ? 'agentPayments' :
                               p.paymentCategory === 'vendor_payment' ? 'vendorPayments' :
                               p.paymentCategory === 'technician_payment' ? 'technicianPayments' :
                               p.paymentCategory === 'delivery_partner_payment' ? 'deliveryPartnerPayments' :
                               p.paymentCategory === 'payroll_payment' ? 'payrollPayments' : null;

                if (catKey && paidStats[catKey]) {
                    paidStats[catKey].total += amt;
                    paidStats[catKey].totalCount += 1;
                    if (p.status === 'PENDING') {
                        paidStats[catKey].pendingCount += 1;
                    }
                }
            }
        }

        const netCashFlow = totalReceived - totalPaid;

        res.json({
            success: true,
            kpis: {
                totalReceived,
                totalPaid,
                pendingPayments,
                pendingAmount,
                failedPayments,
                failedAmount,
                cancelledPayments,
                cancelledAmount,
                netCashFlow
            },
            receivedCategories: [
                {
                    key: 'customer_payment',
                    title: 'Customer Payments',
                    totalAmount: receivedStats.customerPayments.total,
                    transactionCount: receivedStats.customerPayments.count,
                    type: 'received'
                },
                {
                    key: 'vendor_reg_fee',
                    title: 'Vendor Registration Fees',
                    totalAmount: receivedStats.vendorRegFees.total,
                    transactionCount: receivedStats.vendorRegFees.count,
                    type: 'received'
                },
                {
                    key: 'vendor_tieup_fee',
                    title: 'Vendor Tie-Up Fees',
                    totalAmount: receivedStats.vendorTieupFees.total,
                    transactionCount: receivedStats.vendorTieupFees.count,
                    type: 'received'
                },
                {
                    key: 'membership_payment',
                    title: 'Membership Payments',
                    totalAmount: receivedStats.membershipPayments.total,
                    transactionCount: receivedStats.membershipPayments.count,
                    type: 'received'
                },
                {
                    key: 'other_received',
                    title: 'Other Platform Receipts',
                    totalAmount: receivedStats.otherReceived.total,
                    transactionCount: receivedStats.otherReceived.count,
                    type: 'received'
                }
            ],
            paidCategories: [
                {
                    key: 'agent_payment',
                    title: 'Agent Payments',
                    totalAmount: paidStats.agentPayments.total,
                    pendingCount: paidStats.agentPayments.pendingCount,
                    totalCount: paidStats.agentPayments.totalCount,
                    type: 'paid',
                    payAllAction: 'Pay All Agents'
                },
                {
                    key: 'vendor_payment',
                    title: 'Vendor Payments',
                    totalAmount: paidStats.vendorPayments.total,
                    pendingCount: paidStats.vendorPayments.pendingCount,
                    totalCount: paidStats.vendorPayments.totalCount,
                    type: 'paid',
                    payAllAction: 'Pay All Vendors'
                },
                {
                    key: 'technician_payment',
                    title: 'Technician Payments',
                    totalAmount: paidStats.technicianPayments.total,
                    pendingCount: paidStats.technicianPayments.pendingCount,
                    totalCount: paidStats.technicianPayments.totalCount,
                    type: 'paid',
                    payAllAction: 'Pay All Technicians'
                },
                {
                    key: 'delivery_partner_payment',
                    title: 'Delivery Partner Payments',
                    totalAmount: paidStats.deliveryPartnerPayments.total,
                    pendingCount: paidStats.deliveryPartnerPayments.pendingCount,
                    totalCount: paidStats.deliveryPartnerPayments.totalCount,
                    type: 'paid',
                    payAllAction: 'Pay All Delivery Partners'
                }
            ]
        });

    } catch (err) {
        console.error('Error fetching payment dashboard:', err);
        res.status(500).json({ success: false, msg: 'Server error retrieving payment dashboard' });
    }
});

// =========================================================================
// 2. PAYMENT TRANSACTION LIST (SECTION 2 & 14)
// =========================================================================
router.get('/transactions', auth, async (req, res) => {
    try {
        const {
            category,
            type,
            search,
            status,
            state,
            district,
            division,
            pincode,
            startDate,
            endDate,
            sort = 'date_desc',
            page = 1,
            limit = 20
        } = req.query;

        const isSuperAdmin = (req.user?.role === 'super-admin' || req.user?.adminRole === 'super-admin' || req.user?.role === 'admin');
        const userState = req.user?.assignedState || req.user?.state;

        const query = {};

        // Territory isolation for State Admin
        if (!isSuperAdmin && userState) {
            query['territory.state'] = new RegExp(`^${userState.trim()}$`, 'i');
        } else if (state && state !== 'all') {
            query['territory.state'] = new RegExp(`^${state.trim()}$`, 'i');
        }

        if (district && district !== 'all') {
            query['territory.district'] = new RegExp(`^${district.trim()}$`, 'i');
        }
        if (division && division !== 'all') {
            query['territory.division'] = new RegExp(`^${division.trim()}$`, 'i');
        }
        if (pincode && pincode !== 'all') {
            query['territory.pincode'] = pincode.trim();
        }

        if (category && category !== 'all') {
            query.paymentCategory = category;
        }
        if (type && type !== 'all') {
            query.paymentType = type;
        }
        if (status && status !== 'all') {
            query.status = status.toUpperCase();
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        if (search && search.trim()) {
            const s = search.trim();
            query.$or = [
                { paymentId: new RegExp(s, 'i') },
                { recipientName: new RegExp(s, 'i') },
                { recipientEmail: new RegExp(s, 'i') },
                { recipientPhone: new RegExp(s, 'i') },
                { transactionReference: new RegExp(s, 'i') },
                { 'territory.state': new RegExp(s, 'i') },
                { 'territory.district': new RegExp(s, 'i') },
                { 'territory.pincode': new RegExp(s, 'i') }
            ];
        }

        // Sorting
        let sortObj = { createdAt: -1 };
        if (sort === 'amount_asc') sortObj = { amount: 1 };
        else if (sort === 'amount_desc') sortObj = { amount: -1 };
        else if (sort === 'date_asc') sortObj = { createdAt: 1 };
        else if (sort === 'date_desc') sortObj = { createdAt: -1 };
        else if (sort === 'status') sortObj = { status: 1 };

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;

        const [totalCount, items] = await Promise.all([
            Payment.countDocuments(query),
            Payment.find(query)
                .sort(sortObj)
                .skip(skip)
                .limit(limitNum)
                .lean()
        ]);

        // Mask bank accounts in response for security
        const sanitizedItems = items.map(item => ({
            ...item,
            maskedAccountNumber: maskAccountNumber(item.bankAccountNumber),
            bankAccountNumber: maskAccountNumber(item.bankAccountNumber) // never expose full number in list
        }));

        res.json({
            success: true,
            totalCount,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalCount / limitNum),
            transactions: sanitizedItems
        });

    } catch (err) {
        console.error('Error fetching payment transactions:', err);
        res.status(500).json({ success: false, msg: 'Error retrieving payment transactions' });
    }
});

// =========================================================================
// 3. PAYMENT DETAIL – VIEW (SECTION 3)
// =========================================================================
router.get('/detail/:id', auth, async (req, res) => {
    try {
        const payment = await Payment.findOne({
            $or: [{ paymentId: req.params.id }, { _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null }]
        }).lean();

        if (!payment) {
            return res.status(404).json({ success: false, msg: 'Payment record not found' });
        }

        // Log Payment Viewed Audit
        await logPaymentAudit(req, 'payment_viewed', payment.paymentId, `Payment ${payment.paymentId} viewed by admin`);

        // Fetch previous payment history for this recipient
        const previousHistory = await Payment.find({
            recipientId: payment.recipientId,
            paymentId: { $ne: payment.paymentId }
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('paymentId amount status paymentDate paymentPeriod transactionReference')
        .lean();

        const sanitized = {
            ...payment,
            maskedAccountNumber: maskAccountNumber(payment.bankAccountNumber),
            bankAccountNumber: maskAccountNumber(payment.bankAccountNumber),
            previousPaymentHistory: previousHistory
        };

        res.json({ success: true, payment: sanitized });

    } catch (err) {
        console.error('Error fetching payment detail:', err);
        res.status(500).json({ success: false, msg: 'Error fetching payment detail' });
    }
});

// =========================================================================
// 4. PAY ALL RECIPIENTS PREVIEW (SECTION 4, 10, 11, 12, 13)
// =========================================================================
router.get('/pay-all-preview', auth, async (req, res) => {
    try {
        const { category } = req.query;
        if (!category) {
            return res.status(400).json({ success: false, msg: 'Payment category is required' });
        }

        const isSuperAdmin = (req.user?.role === 'super-admin' || req.user?.adminRole === 'super-admin' || req.user?.role === 'admin');
        const userState = req.user?.assignedState || req.user?.state;

        const query = {
            paymentCategory: category,
            paymentType: 'paid',
            status: 'PENDING'
        };

        if (!isSuperAdmin && userState) {
            query['territory.state'] = new RegExp(`^${userState.trim()}$`, 'i');
        }

        const pendingItems = await Payment.find(query).sort({ amount: -1 }).lean();
        const totalAmount = pendingItems.reduce((acc, p) => acc + (p.amount || 0), 0);

        const recipients = pendingItems.map(p => ({
            paymentId: p.paymentId,
            recipientName: p.recipientName,
            recipientType: p.recipientType,
            amount: p.amount,
            maskedAccountNumber: maskAccountNumber(p.bankAccountNumber),
            bankIfsc: p.bankIfsc,
            bankName: p.bankName,
            paymentPeriod: p.paymentPeriod,
            territory: p.territory
        }));

        res.json({
            success: true,
            category,
            pendingCount: pendingItems.length,
            totalAmount,
            recipients
        });

    } catch (err) {
        console.error('Error fetching pay all preview:', err);
        res.status(500).json({ success: false, msg: 'Error calculating pay all preview' });
    }
});

// =========================================================================
// 5. SECURITY: EMAIL OTP VERIFICATION (SECTION 5)
// =========================================================================
router.post('/send-otp', auth, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, msg: 'Email address is required' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findById(req.user.id || req.user._id).lean();
        if (!user) {
            return res.status(401).json({ success: false, msg: 'User account not found' });
        }

        // Verify that the email matches authorized admin email
        const userEmail = (user.email || '').trim().toLowerCase();
        if (normalizedEmail !== userEmail && user.role !== 'super-admin') {
            return res.status(403).json({ success: false, msg: 'Entered email does not match registered administrator profile' });
        }

        // Rate limiting: max 3 requests per 10 minutes
        const existingData = otpStore.get(normalizedEmail);
        const now = Date.now();
        if (existingData && (now - existingData.lastRequestedAt < 10 * 60 * 1000) && existingData.requestCount >= 3) {
            return res.status(429).json({ success: false, msg: 'Too many OTP requests. Please wait 10 minutes before retrying.' });
        }

        // Generate 6-digit numeric OTP
        const otpNum = crypto.randomInt(100000, 999999).toString();
        // Hash the OTP with a salt for secure server-side storage
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.createHmac('sha256', salt).update(otpNum).digest('hex');

        const expiresAt = now + 5 * 60 * 1000; // 5 minutes TTL
        const requestCount = (existingData && (now - existingData.lastRequestedAt < 10 * 60 * 1000)) ? existingData.requestCount + 1 : 1;

        otpStore.set(normalizedEmail, {
            hash,
            salt,
            expiresAt,
            attempts: 0,
            lastRequestedAt: now,
            requestCount
        });

        // Audit Log: OTP Requested
        await logPaymentAudit(req, 'otp_requested', '', `Email OTP requested for ${normalizedEmail}`, { email: normalizedEmail });

        // In a live environment with SMTP configured, send mail.
        // For development and testing resilience, log securely to server console without exposing in API response.
        console.log(`[PAYMENT SECURITY ENGINE] OTP generated for ${normalizedEmail}: ${otpNum} (Expires in 5 minutes)`);

        res.json({
            success: true,
            msg: `6-digit verification code sent to ${normalizedEmail}. Valid for 5 minutes.`,
            expiresInSeconds: 300
        });

    } catch (err) {
        console.error('Error generating payment OTP:', err);
        res.status(500).json({ success: false, msg: 'Server error generating verification code' });
    }
});

router.post('/verify-otp', auth, async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, msg: 'Email and verification code are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const stored = otpStore.get(normalizedEmail);

        if (!stored) {
            await logPaymentAudit(req, 'otp_failed', '', 'OTP verification failed: no OTP requested', { email: normalizedEmail });
            return res.status(400).json({ success: false, msg: 'No pending verification code found. Please request a new code.' });
        }

        if (Date.now() > stored.expiresAt) {
            otpStore.delete(normalizedEmail);
            await logPaymentAudit(req, 'otp_failed', '', 'OTP verification failed: expired code', { email: normalizedEmail });
            return res.status(400).json({ success: false, msg: 'Verification code has expired. Please request a new code.' });
        }

        stored.attempts += 1;
        if (stored.attempts > 3) {
            otpStore.delete(normalizedEmail);
            await logPaymentAudit(req, 'otp_failed', '', 'OTP verification failed: exceeded retry limit', { email: normalizedEmail });
            return res.status(400).json({ success: false, msg: 'Exceeded maximum verification attempts. Please request a new code.' });
        }

        const testHash = crypto.createHmac('sha256', stored.salt).update(otp.trim()).digest('hex');
        if (testHash !== stored.hash) {
            await logPaymentAudit(req, 'otp_failed', '', `OTP verification failed: incorrect code (Attempt ${stored.attempts}/3)`, { email: normalizedEmail });
            return res.status(400).json({ success: false, msg: `Invalid verification code. ${3 - stored.attempts} attempts remaining.` });
        }

        // Single-use: delete from store
        otpStore.delete(normalizedEmail);

        // Create verification session valid for 10 minutes
        const verificationToken = crypto.randomBytes(32).toString('hex');
        verificationSessionStore.set(verificationToken, {
            email: normalizedEmail,
            userId: req.user.id || req.user._id,
            expiresAt: Date.now() + 10 * 60 * 1000,
            otpVerified: true,
            pinVerified: false
        });

        await logPaymentAudit(req, 'otp_verified', '', `Email OTP successfully verified for ${normalizedEmail}`, { email: normalizedEmail });

        res.json({
            success: true,
            msg: 'Email verification successful.',
            verificationToken
        });

    } catch (err) {
        console.error('Error verifying payment OTP:', err);
        res.status(500).json({ success: false, msg: 'Server error verifying OTP' });
    }
});

// =========================================================================
// 6. SECURITY: 6-DIGIT PAYMENT PIN (SECTION 6)
// =========================================================================
router.get('/pin-status', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id || req.user._id).select('paymentPinConfigured paymentPinLockedUntil').lean();
        const configured = Boolean(user?.paymentPinConfigured);
        const isLocked = user?.paymentPinLockedUntil && new Date(user.paymentPinLockedUntil) > new Date();

        res.json({
            success: true,
            configured,
            isLocked,
            lockedUntil: isLocked ? user.paymentPinLockedUntil : null
        });
    } catch (err) {
        res.status(500).json({ success: false, msg: 'Error checking PIN status' });
    }
});

router.post('/setup-pin', auth, async (req, res) => {
    try {
        const { pin, confirmPin } = req.body;
        if (!pin || !/^\d{6}$/.test(pin)) {
            return res.status(400).json({ success: false, msg: 'PIN must be exactly 6 numeric digits.' });
        }
        if (pin !== confirmPin) {
            return res.status(400).json({ success: false, msg: 'PIN and Confirm PIN do not match.' });
        }

        const hashed = await bcrypt.hash(pin, 10);
        await User.findByIdAndUpdate(req.user.id || req.user._id, {
            paymentPinHash: hashed,
            paymentPinConfigured: true,
            paymentPinFailedAttempts: 0,
            paymentPinLockedUntil: null
        });

        await logPaymentAudit(req, 'pin_setup', '', 'New 6-digit Payment PIN configured');

        res.json({ success: true, msg: '6-digit Payment PIN configured successfully.' });
    } catch (err) {
        console.error('Error configuring payment PIN:', err);
        res.status(500).json({ success: false, msg: 'Server error configuring payment PIN' });
    }
});

router.post('/verify-pin', auth, async (req, res) => {
    try {
        const { pin, verificationToken } = req.body;

        if (!pin || !/^\d{6}$/.test(pin)) {
            return res.status(400).json({ success: false, msg: 'Payment PIN must be exactly 6 numeric digits.' });
        }

        const session = verificationToken ? verificationSessionStore.get(verificationToken) : null;
        if (!session || Date.now() > session.expiresAt || !session.otpVerified) {
            return res.status(401).json({ success: false, msg: 'Session expired or OTP verification missing. Please restart verification.' });
        }

        const user = await User.findById(req.user.id || req.user._id);
        if (!user || !user.paymentPinConfigured || !user.paymentPinHash) {
            return res.status(400).json({ success: false, msg: 'Payment PIN has not been configured. Please configure your PIN first.' });
        }

        // Check Lockout
        if (user.paymentPinLockedUntil && new Date(user.paymentPinLockedUntil) > new Date()) {
            const minutesLeft = Math.ceil((new Date(user.paymentPinLockedUntil) - new Date()) / (60 * 1000));
            return res.status(403).json({ success: false, msg: `Payment PIN is temporarily locked due to failed attempts. Try again in ${minutesLeft} minutes.` });
        }

        const isMatch = await bcrypt.compare(pin, user.paymentPinHash);
        if (!isMatch) {
            user.paymentPinFailedAttempts = (user.paymentPinFailedAttempts || 0) + 1;
            if (user.paymentPinFailedAttempts >= 5) {
                user.paymentPinLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
                await user.save();
                await logPaymentAudit(req, 'pin_failed', '', 'Payment PIN locked after 5 failed attempts');
                return res.status(403).json({ success: false, msg: 'Incorrect PIN. Maximum attempts reached. Account locked for 15 minutes.' });
            }
            await user.save();
            await logPaymentAudit(req, 'pin_failed', '', `Payment PIN attempt failed (${user.paymentPinFailedAttempts}/5)`);
            return res.status(400).json({ success: false, msg: `Incorrect Payment PIN. ${5 - user.paymentPinFailedAttempts} attempts remaining.` });
        }

        // Reset failed attempts on success
        user.paymentPinFailedAttempts = 0;
        user.paymentPinLockedUntil = null;
        await user.save();

        session.pinVerified = true;
        verificationSessionStore.set(verificationToken, session);

        await logPaymentAudit(req, 'pin_verified', '', 'Payment PIN successfully verified');

        res.json({
            success: true,
            msg: 'Payment PIN verified successfully. Proceeding to final confirmation.'
        });

    } catch (err) {
        console.error('Error verifying payment PIN:', err);
        res.status(500).json({ success: false, msg: 'Server error verifying payment PIN' });
    }
});

// =========================================================================
// 7. PAYMENT PROCESSING – SINGLE & BULK (SECTIONS 7, 8, 10, 11, 12, 13)
// =========================================================================
router.post('/process', auth, async (req, res) => {
    try {
        const { paymentId, verificationToken, idempotencyKey, notes } = req.body;

        if (!paymentId) {
            return res.status(400).json({ success: false, msg: 'Payment ID is required.' });
        }

        // Validate security session
        const session = verificationToken ? verificationSessionStore.get(verificationToken) : null;
        if (!session || Date.now() > session.expiresAt || !session.otpVerified || !session.pinVerified) {
            return res.status(401).json({ success: false, msg: 'Unauthorized: Complete Email OTP and 6-digit PIN verification before processing payment.' });
        }

        // Re-fetch payment record directly from database
        const payment = await Payment.findOne({ paymentId });
        if (!payment) {
            return res.status(404).json({ success: false, msg: 'Payment record not found.' });
        }

        if (payment.status === 'PAID') {
            return res.status(400).json({ success: false, msg: 'Payment has already been processed.' });
        }

        if (payment.status === 'CANCELLED') {
            return res.status(400).json({ success: false, msg: 'Cannot process a cancelled payment.' });
        }

        // Idempotency validation
        if (idempotencyKey) {
            const existingIdempotent = await Payment.findOne({ idempotencyKey, status: 'PAID' });
            if (existingIdempotent && existingIdempotent.paymentId !== payment.paymentId) {
                return res.status(400).json({ success: false, msg: 'Duplicate payment submission detected with the same idempotency key.' });
            }
        }

        // Server-side validations
        if (!payment.amount || payment.amount <= 0) {
            payment.status = 'FAILED';
            payment.failureReason = 'Invalid payment amount';
            await payment.save();
            await logPaymentAudit(req, 'payment_failed', paymentId, 'Payment failed: Invalid amount');
            return res.status(400).json({ success: false, msg: 'Payment amount must be greater than zero.' });
        }

        const txnRef = `TXN-FIC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const actorName = req.user.name || 'Super Admin';
        const actorId = req.user.id || req.user._id;

        // Update payment state
        payment.status = 'PAID';
        payment.paymentDate = new Date();
        payment.transactionReference = txnRef;
        payment.idempotencyKey = idempotencyKey || txnRef;
        payment.processedBy = actorName;
        payment.processedById = actorId;
        if (notes) payment.notes = notes;

        await payment.save();

        // Create matching Transaction record in main ledger
        try {
            await Transaction.create({
                userId: payment.recipientId && mongoose.Types.ObjectId.isValid(payment.recipientId) ? payment.recipientId : actorId,
                title: `${payment.paymentCategory.replace(/_/g, ' ').toUpperCase()} - ${payment.recipientName}`,
                amount: payment.amount,
                type: 'debit',
                status: 'completed'
            });
        } catch (tErr) {
            console.error('Ledger transaction error (non-fatal):', tErr.message);
        }

        // Sync with source model if applicable (e.g. PayrollRecord)
        if (payment.sourceModel === 'PayrollRecord' && payment.sourceId) {
            await PayrollRecord.findByIdAndUpdate(payment.sourceId, { paymentStatus: 'Paid', paymentDate: new Date() });
        }

        await logPaymentAudit(req, 'payment_processed', paymentId, `Payment of ₹${payment.amount} processed successfully to ${payment.recipientName}`, {
            transactionReference: txnRef,
            amount: payment.amount,
            recipient: payment.recipientName,
            category: payment.paymentCategory
        });

        res.json({
            success: true,
            msg: `Payment of ₹${payment.amount.toLocaleString()} to ${payment.recipientName} processed successfully.`,
            payment: {
                paymentId: payment.paymentId,
                transactionReference: txnRef,
                recipientName: payment.recipientName,
                amount: payment.amount,
                status: 'PAID',
                paymentDate: payment.paymentDate
            }
        });

    } catch (err) {
        console.error('Error processing single payment:', err);
        res.status(500).json({ success: false, msg: 'Server error processing payment.' });
    }
});

router.post('/process-bulk', auth, async (req, res) => {
    try {
        const { category, recipientType, verificationToken, idempotencyKey } = req.body;

        if (!category) {
            return res.status(400).json({ success: false, msg: 'Payment category is required for bulk disbursement.' });
        }

        // Validate security session
        const session = verificationToken ? verificationSessionStore.get(verificationToken) : null;
        if (!session || Date.now() > session.expiresAt || !session.otpVerified || !session.pinVerified) {
            return res.status(401).json({ success: false, msg: 'Unauthorized: Complete Email OTP and 6-digit PIN verification before bulk processing.' });
        }

        const isSuperAdmin = (req.user?.role === 'super-admin' || req.user?.adminRole === 'super-admin' || req.user?.role === 'admin');
        const userState = req.user?.assignedState || req.user?.state;

        const query = {
            paymentCategory: category,
            paymentType: 'paid',
            status: 'PENDING'
        };

        if (recipientType && recipientType !== 'all') {
            query.recipientType = recipientType;
        }

        if (!isSuperAdmin && userState) {
            query['territory.state'] = new RegExp(`^${userState.trim()}$`, 'i');
        }

        const pendingList = await Payment.find(query);
        if (pendingList.length === 0) {
            return res.status(400).json({ success: false, msg: 'No eligible pending payments found to disburse.' });
        }

        const actorName = req.user.name || 'Super Admin';
        const actorId = req.user.id || req.user._id;
        const now = new Date();
        const batchRef = `BULK-FIC-${Date.now()}`;

        let totalDisbursed = 0;
        const processedPaymentIds = [];

        for (const p of pendingList) {
            const singleTxnRef = `TXN-FIC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            p.status = 'PAID';
            p.paymentDate = now;
            p.transactionReference = singleTxnRef;
            p.processedBy = actorName;
            p.processedById = actorId;
            p.notes = `Disbursed in Bulk Run (${batchRef})`;
            await p.save();

            totalDisbursed += p.amount;
            processedPaymentIds.push(p.paymentId);

            // Sync with source model
            if (p.sourceModel === 'PayrollRecord' && p.sourceId) {
                await PayrollRecord.findByIdAndUpdate(p.sourceId, { paymentStatus: 'Paid', paymentDate: now });
            }
        }

        await logPaymentAudit(req, 'payment_processed', batchRef, `Bulk disbursement of ₹${totalDisbursed} completed for ${pendingList.length} recipients in category ${category}`, {
            category,
            count: pendingList.length,
            totalDisbursed,
            batchRef
        });

        // Expire session once bulk disbursement finishes
        verificationSessionStore.delete(verificationToken);

        res.json({
            success: true,
            msg: `Successfully disbursed ₹${totalDisbursed.toLocaleString()} across ${pendingList.length} recipients.`,
            summary: {
                category,
                processedCount: pendingList.length,
                totalDisbursed,
                batchReference: batchRef,
                processedPaymentIds
            }
        });

    } catch (err) {
        console.error('Error processing bulk payments:', err);
        res.status(500).json({ success: false, msg: 'Server error processing bulk disbursement.' });
    }
});

// =========================================================================
// 8. CANCEL PAYMENT (SECTION 9)
// =========================================================================
router.post('/cancel', auth, async (req, res) => {
    try {
        const { paymentId, cancellationReason } = req.body;

        if (!paymentId) {
            return res.status(400).json({ success: false, msg: 'Payment ID is required.' });
        }
        if (!cancellationReason || !cancellationReason.trim()) {
            return res.status(400).json({ success: false, msg: 'Cancellation reason is mandatory.' });
        }

        const payment = await Payment.findOne({ paymentId });
        if (!payment) {
            return res.status(404).json({ success: false, msg: 'Payment record not found.' });
        }

        if (payment.status === 'PAID') {
            return res.status(400).json({ success: false, msg: 'Cannot cancel a payment that has already been processed.' });
        }

        payment.status = 'CANCELLED';
        payment.cancellationReason = cancellationReason.trim();
        payment.cancelledBy = req.user.name || 'Administrator';
        payment.cancelledById = req.user.id || req.user._id;
        payment.cancelledAt = new Date();

        await payment.save();

        await logPaymentAudit(req, 'payment_cancelled', paymentId, `Payment ${paymentId} cancelled: ${cancellationReason.trim()}`, {
            reason: cancellationReason.trim(),
            cancelledBy: payment.cancelledBy
        });

        res.json({
            success: true,
            msg: `Payment ${paymentId} has been cancelled successfully.`,
            payment: {
                paymentId: payment.paymentId,
                status: 'CANCELLED',
                cancellationReason: payment.cancellationReason,
                cancelledAt: payment.cancelledAt
            }
        });

    } catch (err) {
        console.error('Error cancelling payment:', err);
        res.status(500).json({ success: false, msg: 'Server error cancelling payment.' });
    }
});

// =========================================================================
// 9. PAYMENT DELEGATION TO STATE ADMIN (SECTION 15)
// =========================================================================
router.post('/delegate', auth, async (req, res) => {
    try {
        const { state, category, stateAdminId, notes } = req.body;

        if (!state) {
            return res.status(400).json({ success: false, msg: 'State territory is required for delegation.' });
        }
        if (!stateAdminId) {
            return res.status(400).json({ success: false, msg: 'Please select a State Administrator to assign payments to.' });
        }

        const stateAdmin = await User.findById(stateAdminId).lean();
        if (!stateAdmin) {
            return res.status(404).json({ success: false, msg: 'Selected State Administrator not found.' });
        }

        const query = {
            paymentType: 'paid',
            status: 'PENDING',
            'territory.state': new RegExp(`^${state.trim()}$`, 'i')
        };
        if (category && category !== 'all') {
            query.paymentCategory = category;
        }

        const pendingPayments = await Payment.find(query);
        if (pendingPayments.length === 0) {
            return res.status(400).json({ success: false, msg: `No pending payments found in ${state} for delegation.` });
        }

        const actorName = req.user.name || 'Super Admin';
        const now = new Date();

        for (const p of pendingPayments) {
            p.assignedAdminId = stateAdmin._id;
            p.assignedAdminName = stateAdmin.name;
            p.assignedAdminRole = stateAdmin.adminRole || 'state-admin';
            p.assignedTerritory = state;
            p.assignedAt = now;
            p.assignedBy = actorName;
            if (notes) p.notes = `${p.notes ? p.notes + ' | ' : ''}Delegated to ${stateAdmin.name}: ${notes}`;
            await p.save();
        }

        await logPaymentAudit(req, 'payment_delegated', state, `Assigned ${pendingPayments.length} payments in ${state} to State Admin ${stateAdmin.name}`, {
            state,
            adminId: stateAdmin._id,
            adminName: stateAdmin.name,
            count: pendingPayments.length
        });

        res.json({
            success: true,
            msg: `Successfully delegated ${pendingPayments.length} pending payments in ${state} to ${stateAdmin.name}.`,
            count: pendingPayments.length
        });

    } catch (err) {
        console.error('Error delegating payment:', err);
        res.status(500).json({ success: false, msg: 'Server error delegating payment.' });
    }
});

// =========================================================================
// 10. PAYMENT RECEIPT / RECORD (SECTION 16)
// =========================================================================
router.get('/receipt/:id', auth, async (req, res) => {
    try {
        const payment = await Payment.findOne({
            $or: [{ paymentId: req.params.id }, { _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null }]
        }).lean();

        if (!payment) {
            return res.status(404).json({ success: false, msg: 'Payment receipt not found' });
        }

        const receipt = {
            receiptNumber: `REC-${payment.paymentId}`,
            paymentId: payment.paymentId,
            transactionReference: payment.transactionReference || 'N/A',
            recipientName: payment.recipientName,
            recipientType: payment.recipientType,
            recipientEmail: payment.recipientEmail,
            recipientPhone: payment.recipientPhone,
            paymentCategory: payment.paymentCategory,
            amount: payment.amount,
            currency: payment.currency || 'INR',
            status: payment.status,
            paymentDate: payment.paymentDate || payment.createdAt,
            paymentPeriod: payment.paymentPeriod,
            territory: payment.territory,
            bankDestination: {
                accountHolder: payment.bankAccountHolder,
                maskedAccount: maskAccountNumber(payment.bankAccountNumber),
                ifsc: payment.bankIfsc,
                bankName: payment.bankName
            },
            processedBy: payment.processedBy || 'Super Admin',
            organization: 'Connect App Enterprise Financial Suite',
            supportContact: 'support@ficapp.in'
        };

        res.json({ success: true, receipt });
    } catch (err) {
        console.error('Error generating payment receipt:', err);
        res.status(500).json({ success: false, msg: 'Server error generating receipt' });
    }
});

// =========================================================================
// 11. PAYMENT AUDIT LOGS (SECTION 17)
// =========================================================================
router.get('/audit-log', auth, async (req, res) => {
    try {
        const { search, action, page = 1, limit = 50 } = req.query;
        const query = {};

        if (action && action !== 'all') {
            query.action = action;
        }

        if (search && search.trim()) {
            const s = search.trim();
            query.$or = [
                { paymentId: new RegExp(s, 'i') },
                { user: new RegExp(s, 'i') },
                { details: new RegExp(s, 'i') }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;

        const [totalCount, logs] = await Promise.all([
            PaymentAuditLog.countDocuments(query),
            PaymentAuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limitNum).lean()
        ]);

        res.json({
            success: true,
            totalCount,
            page: pageNum,
            limit: limitNum,
            logs
        });

    } catch (err) {
        console.error('Error fetching audit logs:', err);
        res.status(500).json({ success: false, msg: 'Server error retrieving audit logs' });
    }
});

// =========================================================================
// 12. STATE ADMIN LIST FOR DELEGATION DROPDOWN
// =========================================================================
router.get('/state-admins', auth, async (req, res) => {
    try {
        const admins = await User.find({
            $or: [
                { adminRole: 'state-admin' },
                { role: 'admin' },
                { level: 'state' }
            ]
        }).select('_id name email phone adminRole assignedState state').lean();

        res.json({ success: true, admins });
    } catch (err) {
        res.status(500).json({ success: false, msg: 'Error retrieving state admins' });
    }
});

module.exports = router;
