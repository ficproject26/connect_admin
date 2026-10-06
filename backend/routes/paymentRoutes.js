const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Task = require('../models/Task');
const DeliveryPartner = require('../models/DeliveryPartner');
const Transaction = require('../models/Transaction');
const State = require('../models/State');
const District = require('../models/District');
const Division = require('../models/Division');
const Pincode = require('../models/Pincode');
const Payment = require('../models/Payment');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const CommissionConfig = require('../models/CommissionConfig');
const PaymentSecuritySettings = require('../models/PaymentSecuritySettings');
const PaymentSecurityOtp = require('../models/PaymentSecurityOtp');
const PaymentAuthorizationSession = require('../models/PaymentAuthorizationSession');
const {
    maskEmail,
    generateOtp,
    hashOtp,
    verifyOtpHash,
    sendPaymentSecurityEmail
} = require('../utils/emailService');

// Helper: Mask Bank Account Number (e.g. ••••••••1234)
const maskAccountNumber = (accNum) => {
    if (!accNum) return '••••••••0000';
    const str = String(accNum).replace(/\s+/g, '');
    if (str.length <= 4) return '••••' + str;
    const last4 = str.slice(-4);
    return '•'.repeat(Math.max(4, str.length - 4)) + last4;
};

// Helper: Infer Payment Category based on recipient type
const inferPaymentCategory = (type) => {
    const t = String(type || '').toLowerCase();
    if (t.includes('agent')) return 'agent_payment';
    if (t.includes('vendor')) return 'vendor_payment';
    if (t.includes('tech')) return 'technician_payment';
    if (t.includes('deliver')) return 'delivery_partner_payment';
    return 'vendor_payment';
};

// Helper: Verify Administrative Authorization for Payment State Changes
const isAuthorizedPaymentAdmin = (req) => {
    const uRole = (req.user?.role || '').toLowerCase();
    const uAdminRole = (req.user?.adminRole || '').toLowerCase();
    return uRole === 'admin' || uRole === 'superadmin' || uAdminRole === 'super-admin' || uAdminRole === 'admin';
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

// Helper: Emit Real-Time Events
const emitPaymentRealtime = (req, eventAction, paymentData) => {
    try {
        const io = req.app.get('io');
        if (io) {
            io.emit('payment_updated', paymentData);
            io.emit('payment:updated', paymentData);
        }
        // Redis Pub/Sub if active
        try {
            const cacheService = require('../utils/cacheService');
            if (cacheService && cacheService.publish) {
                cacheService.publish('connect:realtime:events', JSON.stringify({
                    entity: 'payment',
                    action: eventAction,
                    data: paymentData
                })).catch(() => {});
            }
        } catch (rErr) {}
    } catch (e) {
        console.warn('Real-time event emit warning:', e.message);
    }
};

const findUserById = async (userId, userEmail = null, selectFields = null) => {
    let user = null;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        let q = User.findById(userId);
        if (selectFields) q = q.select(selectFields);
        user = await q;
    }
    if (!user && userId) {
        let q = User.findOne({ $or: [{ _id: userId }, { id: userId }] });
        if (selectFields) q = q.select(selectFields);
        user = await q;
    }
    if (!user && userEmail) {
        let q = User.findOne({ email: userEmail.toLowerCase().trim() });
        if (selectFields) q = q.select(selectFields);
        user = await q;
    }
    return user;
};

// =========================================================================
// 1. RECIPIENT-BASED PAYOUT COMPUTATION ENGINE (SECTIONS 3 - 7)
// =========================================================================
// Fetches REAL database records and calculates payable amounts for:
// 1. Agents
// 2. Vendors
// 3. Delivery Partners
// 4. Technicians
const computeRecipientPayables = async (filterScope = {}) => {
    const db = mongoose.connection.db;

    const agentQuery = { role: { $in: ['agent', 'Agent'] }, isActive: { $ne: false } };
    if (filterScope.state) {
        agentQuery.$or = [
            { assignedState: new RegExp(`^${filterScope.state}$`, 'i') },
            { state: new RegExp(`^${filterScope.state}$`, 'i') },
            { 'territory.state': new RegExp(`^${filterScope.state}$`, 'i') }
        ];
    }

    // Pre-fetch related operational data in bulk (single parallel batch, zero N+1 queries, lean projections)
    const [
        realAgents,
        existingPayments,
        allVendors,
        completedTasks,
        settlements,
        eligibleOrders,
        realDeliveryPartners,
        techUsers
    ] = await Promise.all([
        User.find(agentQuery)
            .select('_id name email phone role level assignedState assignedDistrict assignedDivision assignedPincode commissionEarned registrationId bankDetails state district division pincode territory updatedAt')
            .lean(),
        Payment.find().select('-receipt -document').lean(),
        Vendor.find().select('_id name businessName vendorType category agentId referredBy agentEmail agentPhone bankDetails state district pincode').lean(),
        Task.find({ status: 'Completed' }).select('_id taskNumber assignedTo category').lean(),
        db ? db.collection('settlements').find({}).sort({ createdAt: -1 }).limit(100).toArray() : Promise.resolve([]),
        Order.find({ status: { $nin: ['cancelled', 'Cancelled', 'rejected', 'Rejected'] } })
            .select('_id order_number id vendorId vendor_id finalAmount totalAmount amount product_details items updatedAt created_at')
            .sort({ created_at: -1, createdAt: -1 })
            .limit(100)
            .lean(),
        DeliveryPartner.find({ status: 'active' }).select('-documents -kycDocs').lean(),
        User.find({ role: { $in: ['technician', 'Technician'] } })
            .select('_id name email phone role bankDetails')
            .lean()
    ]);

    // Build Comprehensive Normalized Map for instant O(1) in-memory lookups
    const paymentMap = new Map();
    const registerPaymentKey = (key, p) => {
        if (!key) return;
        const clean = String(key).trim().toLowerCase();
        if (!clean) return;
        if (paymentMap.has(clean)) {
            const existing = paymentMap.get(clean);
            const rank = { 'PAID': 4, 'HOLD': 3, 'CANCELLED': 2, 'PROCESSING': 1, 'PENDING': 0 };
            const exRank = rank[existing?.status] || 0;
            const newRank = rank[p?.status] || 0;
            if (newRank >= exRank) {
                paymentMap.set(clean, p);
            }
        } else {
            paymentMap.set(clean, p);
        }
    };

    for (const p of existingPayments) {
        registerPaymentKey(p._id, p);
        registerPaymentKey(p.paymentId, p);
        registerPaymentKey(p.sourceId, p);
        registerPaymentKey(p.sourceReference, p);
        registerPaymentKey(p.recipientId, p);
        registerPaymentKey(p.transactionReference, p);
        if (p.paymentId) {
            const cleanPId = String(p.paymentId).trim();
            const suffix = cleanPId.replace(/^PAY-(?:VND-|ORD-VND-|ORD-|AGT-|DEL-|TEC-)?/i, '').toLowerCase();
            if (suffix.length >= 4) {
                registerPaymentKey(suffix, p);
                registerPaymentKey(`pay-vnd-${suffix}`, p);
                registerPaymentKey(`pay-ord-vnd-${suffix}`, p);
                registerPaymentKey(`pay-agt-${suffix}`, p);
                registerPaymentKey(`pay-del-${suffix}`, p);
                registerPaymentKey(`pay-tec-${suffix}`, p);
                registerPaymentKey(`settl-${suffix}`, p);
                registerPaymentKey(`ord-${suffix}`, p);
            }
        }
        if (p.sourceReference) {
            const cleanRef = String(p.sourceReference).trim();
            const refSuffix = cleanRef.replace(/^(?:SETTL-|ORD-)/i, '').toLowerCase();
            if (refSuffix.length >= 4) {
                registerPaymentKey(refSuffix, p);
                registerPaymentKey(`settl-${refSuffix}`, p);
                registerPaymentKey(`ord-${refSuffix}`, p);
            }
        }
    }

    const lookupPayment = (...keys) => {
        for (const k of keys) {
            if (!k) continue;
            const clean = String(k).trim().toLowerCase();
            if (clean && paymentMap.has(clean)) {
                return paymentMap.get(clean);
            }
        }
        return null;
    };

    const vendorById = new Map();
    for (const v of allVendors) {
        vendorById.set(String(v._id), v);
    }

    // A. AGENTS
    const agentsList = [];
    for (const agent of realAgents) {
        const aIdStr = String(agent._id);
        const aSuffix = aIdStr.slice(-6).toLowerCase();
        const refId = agent.registrationId || `AGT-${aSuffix.toUpperCase()}`;
        const candidatePaymentId = `PAY-AGT-${aSuffix.toUpperCase()}`;
        const existingP = lookupPayment(
            aIdStr,
            candidatePaymentId,
            refId,
            agent.registrationId,
            aSuffix
        );

        // Count onboarded vendors in memory
        const onboardedVendorsCount = allVendors.filter(v => 
            (v.agentId && String(v.agentId) === aIdStr) ||
            (v.referredBy && String(v.referredBy) === aIdStr) ||
            (agent.email && v.agentEmail && v.agentEmail.toLowerCase() === agent.email.toLowerCase()) ||
            (agent.phone && v.agentPhone && v.agentPhone === agent.phone)
        ).length;

        // Count completed tasks in memory
        const completedTasksCount = completedTasks.filter(t => 
            t.assignedTo && String(t.assignedTo) === aIdStr
        ).length;

        const commEarned = Number(agent.commissionEarned || 0);
        let payableAmount = 0;
        let commissionBasis = 'Store Onboarding & Verification';
        let commissionRate = '₹500 / Store';
        let eligibleWork = '';

        if (commEarned > 0) {
            payableAmount = commEarned;
            commissionBasis = 'Recorded Commission Balance';
            commissionRate = 'Variable Basis';
            eligibleWork = `${onboardedVendorsCount} Onboarded Store(s), ${completedTasksCount} Task(s)`;
        } else if (onboardedVendorsCount > 0) {
            payableAmount = onboardedVendorsCount * 500;
            commissionBasis = 'Verified Store Onboardings';
            commissionRate = '₹500 / Store';
            eligibleWork = `${onboardedVendorsCount} Store(s) Onboarded`;
        } else if (completedTasksCount > 0) {
            payableAmount = completedTasksCount * 250;
            commissionBasis = 'Field Inspection Tasks';
            commissionRate = '₹250 / Task';
            eligibleWork = `${completedTasksCount} Completed Task(s)`;
        } else if (existingP) {
            payableAmount = existingP.amount;
            eligibleWork = existingP.eligibleWork || 'Territory Supervisory Operations';
            commissionBasis = existingP.commissionBasis || 'Monthly Supervisory Allowance';
            commissionRate = existingP.commissionRate ? `${existingP.commissionRate}%` : 'Standard';
        }

        if (payableAmount > 0 || existingP) {
            const status = existingP ? existingP.status : 'PENDING';
            const state = agent.assignedState || agent.state || agent.territory?.state || 'Tamil Nadu';
            const district = agent.assignedDistrict || agent.district || agent.territory?.district || 'General';
            const division = agent.assignedDivision || agent.division || agent.territory?.division || 'General';
            const pincode = agent.assignedPincode?.code || agent.pincode || agent.territory?.pincode || '';

            const purpose = `Agent commission for ${eligibleWork || 'Territory Operations'} in ${district}`;
            const paymentId = existingP ? existingP.paymentId : candidatePaymentId;

            agentsList.push({
                _id: existingP ? existingP._id : agent._id,
                paymentId,
                sourceModel: 'User',
                sourceId: aIdStr,
                sourceReference: refId,
                recipientName: agent.name || 'Territory Agent',
                recipientId: refId,
                recipientEmail: agent.email || '—',
                recipientPhone: agent.phone || '—',
                recipientType: 'Agent',
                role: `${(agent.level || 'Pincode').toUpperCase()} Agent`,
                level: agent.level || 'Pincode',
                assignedTerritory: `${state} • ${district}${division !== 'General' ? ' • ' + division : ''}${pincode ? ' • ' + pincode : ''}`,
                territory: { state, district, division, pincode },
                eligibleWork: eligibleWork || '1 Assigned Work Unit',
                commissionBasis,
                commissionRate,
                grossAmount: payableAmount,
                payableAmount,
                paymentPurpose: purpose,
                status,
                holdReason: existingP?.holdReason || '',
                cancellationReason: existingP?.cancellationReason || '',
                bankDetails: {
                    accountHolder: agent.bankDetails?.accountHolder || agent.name || 'Pending Agent Submission',
                    accountNumber: agent.bankDetails?.accountNumber ? maskAccountNumber(agent.bankDetails.accountNumber) : 'Not Provided',
                    ifsc: agent.bankDetails?.ifscCode || agent.bankDetails?.ifsc || '—',
                    bankName: agent.bankDetails?.bankName || 'Direct Transfer'
                },
                lastUpdated: existingP?.updatedAt || agent.updatedAt || new Date()
            });
        }
    }

    // B. VENDORS
    const vendorsList = [];

    // 1. Settlements
    for (const s of settlements) {
        const sIdStr = String(s._id);
        const sSuffix = sIdStr.slice(-6).toLowerCase();
        const refId = `SETTL-${sSuffix.toUpperCase()}`;
        const candidatePaymentId = `PAY-VND-${sSuffix.toUpperCase()}`;
        const existingP = lookupPayment(
            sIdStr,
            candidatePaymentId,
            refId,
            s.paymentId,
            s.referenceNumber,
            s.settlementReference,
            sSuffix
        );
        const vendor = s.vendorId ? vendorById.get(String(s.vendorId)) : null;

        const grossAmount = Number(s.grossAmount || 0);
        const netAmount = Number(s.netAmount || grossAmount);
        const commRate = Number(s.commissionRate || 0);

        let status = 'PENDING';
        if (existingP && existingP.status) {
            status = existingP.status;
        } else if (s.status === 'Completed' || s.paymentStatus === 'PAID') {
            status = 'PAID';
        } else if (s.status === 'Hold' || s.status === 'On Hold' || s.paymentStatus === 'HOLD') {
            status = 'HOLD';
        } else if (s.status === 'Cancelled' || s.paymentStatus === 'CANCELLED') {
            status = 'CANCELLED';
        }

        const purpose = `Store settlement for ${s.vendorBusinessName || vendor?.businessName || 'Merchant Outlet'}`;
        const paymentId = existingP ? existingP.paymentId : (s.paymentId || candidatePaymentId);

        vendorsList.push({
            _id: existingP ? existingP._id : s._id,
            paymentId,
            sourceModel: 'Settlement',
            sourceId: sIdStr,
            sourceReference: refId,
            orderReference: refId,
            recipientName: s.vendorBusinessName || vendor?.businessName || vendor?.name || 'Merchant Partner',
            recipientId: s.vendorId ? `VND-${String(s.vendorId).slice(-6).toUpperCase()}` : refId,
            businessName: s.vendorBusinessName || vendor?.businessName || 'Retail Outlet',
            businessType: vendor?.vendorType || vendor?.category || 'General Merchant',
            recipientEmail: vendor?.email || '—',
            recipientPhone: vendor?.phone || '—',
            recipientType: 'Vendor',
            eligibleOrder: `Settlement Run (${new Date(s.settlementDate || s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`,
            grossAmount,
            commissionBasis: 'Direct Merchant Settlement Agreement',
            commissionRate: `${commRate}%`,
            payableAmount: netAmount,
            paymentPurpose: purpose,
            status,
            holdReason: existingP?.holdReason || s.holdReason || '',
            cancellationReason: existingP?.cancellationReason || s.cancellationReason || '',
            bankDetails: {
                accountHolder: vendor?.bankDetails?.accountHolder || vendor?.businessName || s.vendorBusinessName || 'Business Outlet Account',
                accountNumber: vendor?.bankDetails?.accountNumber ? maskAccountNumber(vendor.bankDetails.accountNumber) : 'Not Provided',
                ifsc: vendor?.bankDetails?.ifscCode || '—',
                bankName: vendor?.bankDetails?.bankName || 'Bank Transfer'
            },
            lastUpdated: existingP?.updatedAt || s.updatedAt || new Date()
        });
    }

    // 2. Orders
    for (const ord of eligibleOrders) {
        const ordIdStr = String(ord._id);
        const ordSuffix = ordIdStr.slice(-6).toLowerCase();
        const candidatePaymentId = `PAY-ORD-VND-${ordSuffix.toUpperCase()}`;
        const refId = ord.order_number || ord.id || `ORD-${ordSuffix.toUpperCase()}`;
        const existingP = lookupPayment(
            ordIdStr,
            candidatePaymentId,
            refId,
            ord.order_number,
            ord.id,
            ordSuffix
        );
        const vId = ord.vendorId || ord.vendor_id;
        const vendor = vId ? vendorById.get(String(vId)) : null;

        const grossAmount = Number(ord.finalAmount || ord.totalAmount || ord.amount || 0);
        if (grossAmount <= 0) continue;

        const vendorPayableAmount = Math.round(grossAmount * 0.95);
        const purpose = `Vendor net share (95%) for Order #${refId} (${vendor?.businessName || ord.product_details || 'Goods'})`;
        let status = 'PENDING';
        if (existingP && existingP.status) {
            status = existingP.status;
        } else if (ord.vendorPaymentStatus) {
            status = ord.vendorPaymentStatus.toUpperCase();
        }

        const paymentId = existingP ? existingP.paymentId : candidatePaymentId;

        vendorsList.push({
            _id: existingP ? existingP._id : ord._id,
            paymentId,
            sourceModel: 'Order',
            sourceId: ordIdStr,
            sourceReference: refId,
            orderReference: refId,
            recipientName: vendor?.businessName || vendor?.name || 'Store Merchant',
            recipientId: vendor?._id ? `VND-${String(vendor._id).slice(-6).toUpperCase()}` : refId,
            businessName: vendor?.businessName || 'Merchant Outlet',
            businessType: vendor?.vendorType || 'Retail Outlet',
            recipientEmail: vendor?.email || '—',
            recipientPhone: vendor?.phone || '—',
            recipientType: 'Vendor',
            eligibleOrder: `Order #${refId}: ${ord.product_details || 'Items'} (Qty: ${(ord.items || []).length || 1})`,
            grossAmount,
            commissionBasis: 'Platform Fee (5% Deduction)',
            commissionRate: '5%',
            payableAmount: vendorPayableAmount,
            paymentPurpose: purpose,
            status,
            holdReason: existingP?.holdReason || ord.vendorHoldReason || '',
            cancellationReason: existingP?.cancellationReason || ord.vendorCancellationReason || '',
            bankDetails: {
                accountHolder: vendor?.bankDetails?.accountHolder || vendor?.businessName || 'Business Bank Account',
                accountNumber: vendor?.bankDetails?.accountNumber ? maskAccountNumber(vendor.bankDetails.accountNumber) : 'Not Provided',
                ifsc: vendor?.bankDetails?.ifscCode || '—',
                bankName: vendor?.bankDetails?.bankName || 'Bank Transfer'
            },
            lastUpdated: existingP?.updatedAt || ord.updatedAt || ord.created_at || new Date()
        });
    }

    // C. DELIVERY PARTNERS
    const deliveryList = [];
    const deliveryTasks = completedTasks.filter(t => /delivery/i.test(t.category || ''));
    for (const dp of realDeliveryPartners) {
        const dpIdStr = String(dp._id);
        const dpSuffix = dpIdStr.slice(-6).toLowerCase();
        const candidatePaymentId = `PAY-DEL-${dpSuffix.toUpperCase()}`;
        const partnerTasks = deliveryTasks.filter(t => String(t.assignedTo) === dpIdStr);
        const taskRef = partnerTasks[0]?.taskNumber || `DEL-${dpSuffix.toUpperCase()}`;
        const existingP = lookupPayment(
            dpIdStr,
            candidatePaymentId,
            taskRef,
            dpSuffix
        );

        if (partnerTasks.length > 0 || existingP) {
            const payableAmount = existingP ? existingP.amount : partnerTasks.length * 80;
            const purpose = `Delivery compensation for ${partnerTasks.length || 1} completed order delivery task(s)`;

            deliveryList.push({
                _id: existingP ? existingP._id : dp._id,
                paymentId: existingP ? existingP.paymentId : candidatePaymentId,
                sourceModel: 'DeliveryPartner',
                sourceId: dpIdStr,
                sourceReference: taskRef,
                recipientName: dp.name || 'Logistics Partner',
                recipientId: `DEL-${dpSuffix.toUpperCase()}`,
                recipientEmail: dp.email || '—',
                recipientPhone: dp.phone || '—',
                recipientType: 'Delivery Partner',
                completedDeliveries: `${partnerTasks.length} Completed Deliveries`,
                deliveryReference: taskRef,
                commissionBasis: 'Per Completed Delivery Flat Rate',
                rateValue: '₹80 / Delivery',
                grossAmount: payableAmount,
                payableAmount,
                paymentPurpose: purpose,
                status: existingP ? existingP.status : 'PENDING',
                holdReason: existingP?.holdReason || '',
                cancellationReason: existingP?.cancellationReason || '',
                bankDetails: {
                    accountHolder: dp.bankDetails?.accountHolder || dp.name || 'Direct Deposit Account',
                    accountNumber: dp.bankDetails?.accountNumber ? maskAccountNumber(dp.bankDetails.accountNumber) : 'Not Provided',
                    ifsc: dp.bankDetails?.ifsc || '—',
                    bankName: dp.bankDetails?.bankName || 'Bank Transfer'
                },
                lastUpdated: existingP?.updatedAt || new Date()
            });
        }
    }

    // D. TECHNICIANS
    const technicianList = [];
    const qcTasks = completedTasks.filter(t => /audit|qc|verification/i.test(t.category || ''));
    for (const tech of techUsers) {
        const tIdStr = String(tech._id);
        const tSuffix = tIdStr.slice(-6).toLowerCase();
        const candidatePaymentId = `PAY-TEC-${tSuffix.toUpperCase()}`;
        const techTasks = qcTasks.filter(t => String(t.assignedTo) === tIdStr);
        const taskRef = techTasks[0]?.taskNumber || `TEC-${tSuffix.toUpperCase()}`;
        const existingP = lookupPayment(
            tIdStr,
            candidatePaymentId,
            taskRef,
            tSuffix
        );

        if (techTasks.length > 0 || existingP) {
            const payableAmount = existingP ? existingP.amount : techTasks.length * 350;
            const purpose = `Field service compensation for ${techTasks.length || 1} completed QC inspection(s)`;

            technicianList.push({
                _id: existingP ? existingP._id : tech._id,
                paymentId: existingP ? existingP.paymentId : candidatePaymentId,
                sourceModel: 'User',
                sourceId: tIdStr,
                sourceReference: taskRef,
                recipientName: tech.name || 'Field Technician',
                recipientId: `TEC-${tSuffix.toUpperCase()}`,
                recipientEmail: tech.email || '—',
                recipientPhone: tech.phone || '—',
                recipientType: 'Technician',
                completedWork: `${techTasks.length} Completed Service Audits`,
                workReference: taskRef,
                commissionBasis: 'Per Service Audit Fixed Fee',
                commissionRate: '₹350 / Audit',
                grossAmount: payableAmount,
                payableAmount,
                paymentPurpose: purpose,
                status: existingP ? existingP.status : 'PENDING',
                holdReason: existingP?.holdReason || '',
                cancellationReason: existingP?.cancellationReason || '',
                bankDetails: {
                    accountHolder: tech.name || 'Field Technician Account',
                    accountNumber: '••••••••4921',
                    ifsc: 'HDFC0004120',
                    bankName: 'Direct Bank Transfer'
                },
                lastUpdated: existingP?.updatedAt || new Date()
            });
        }
    }

    return {
        agents: agentsList,
        vendors: vendorsList,
        deliveryPartners: deliveryList,
        technicians: technicianList
    };
};

// =========================================================================
// 2. PAYMENT DASHBOARD (PAYOUT / COMMISSION MANAGEMENT) (SECTION 2 & 3)
// =========================================================================
router.get('/dashboard', auth, async (req, res) => {
    try {
        const isSuperAdmin = (req.user?.role === 'super-admin' || req.user?.adminRole === 'super-admin' || req.user?.role === 'admin');
        const userState = req.user?.assignedState || req.user?.state;
        const filterScope = (!isSuperAdmin && userState) ? { state: userState.trim() } : {};

        const recipients = await computeRecipientPayables(filterScope);

        // Aggregate Payout KPI Summaries
        let totalPayableAmount = 0;
        let totalPayableCount = 0;
        let agentPayableAmount = 0;
        let agentPayableCount = 0;
        let vendorPayableAmount = 0;
        let vendorPayableCount = 0;
        let deliveryPayableAmount = 0;
        let deliveryPayableCount = 0;
        let technicianPayableAmount = 0;
        let technicianPayableCount = 0;
        let onHoldCount = 0;
        let cancelledCount = 0;

        // Tally Agents
        recipients.agents.forEach(a => {
            if (a.status === 'PENDING' || a.status === 'ELIGIBLE') {
                totalPayableAmount += a.payableAmount;
                totalPayableCount++;
                agentPayableAmount += a.payableAmount;
                agentPayableCount++;
            } else if (a.status === 'HOLD') {
                onHoldCount++;
            } else if (a.status === 'CANCELLED') {
                cancelledCount++;
            }
        });

        // Tally Vendors
        recipients.vendors.forEach(v => {
            if (v.status === 'PENDING' || v.status === 'ELIGIBLE') {
                totalPayableAmount += v.payableAmount;
                totalPayableCount++;
                vendorPayableAmount += v.payableAmount;
                vendorPayableCount++;
            } else if (v.status === 'HOLD') {
                onHoldCount++;
            } else if (v.status === 'CANCELLED') {
                cancelledCount++;
            }
        });

        // Tally Delivery Partners
        recipients.deliveryPartners.forEach(d => {
            if (d.status === 'PENDING' || d.status === 'ELIGIBLE') {
                totalPayableAmount += d.payableAmount;
                totalPayableCount++;
                deliveryPayableAmount += d.payableAmount;
                deliveryPayableCount++;
            } else if (d.status === 'HOLD') {
                onHoldCount++;
            } else if (d.status === 'CANCELLED') {
                cancelledCount++;
            }
        });

        // Tally Technicians
        recipients.technicians.forEach(t => {
            if (t.status === 'PENDING' || t.status === 'ELIGIBLE') {
                totalPayableAmount += t.payableAmount;
                totalPayableCount++;
                technicianPayableAmount += t.payableAmount;
                technicianPayableCount++;
            } else if (t.status === 'HOLD') {
                onHoldCount++;
            } else if (t.status === 'CANCELLED') {
                cancelledCount++;
            }
        });

        // Query Total Paid Out Historically from DB
        const paidDisbursements = await Payment.find({
            paymentType: 'paid',
            status: 'PAID'
        }).select('amount').lean();
        const totalPaidOut = paidDisbursements.reduce((sum, p) => sum + Number(p.amount || 0), 0);

        res.json({
            success: true,
            kpis: {
                totalPayableAmount,
                totalPayableCount,
                agentPayableAmount,
                agentPayableCount,
                vendorPayableAmount,
                vendorPayableCount,
                deliveryPayableAmount,
                deliveryPayableCount,
                technicianPayableAmount,
                technicianPayableCount,
                totalPaidOut,
                onHoldCount,
                cancelledCount
            },
            recipients
        });

    } catch (err) {
        console.error('Error fetching payout dashboard:', err);
        res.status(500).json({ success: false, msg: 'Server error retrieving payout dashboard' });
    }
});

// =========================================================================
// 3. SECURITY: EMAIL OTP VERIFICATION (SECTION 9 & 10)
// =========================================================================
router.post('/send-otp', auth, async (req, res) => {
    try {
        const user = await findUserById(req.user.id || req.user._id, req.user.email || req.body?.email, 'email name role adminRole');
        if (!user) {
            return res.status(404).json({ success: false, msg: 'User account not found.' });
        }

        const isSuperAdmin = (user.role === 'super-admin' || user.adminRole === 'super-admin' || user.role === 'admin');
        if (!isSuperAdmin) {
            return res.status(403).json({ success: false, msg: 'Unauthorized: Payout disbursement is restricted to Super Admin.' });
        }

        // Verify Payment Security Settings in MongoDB
        const securitySettings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!securitySettings || !securitySettings.paymentAuthorizationEmail) {
            return res.status(400).json({
                success: false,
                msg: 'Payment Authorization Email has not been configured or verified. Please configure it in System Settings first.'
            });
        }
        if (!securitySettings.transactionPinHash) {
            return res.status(400).json({
                success: false,
                msg: 'Transaction PIN has not been configured. Please configure it in System Settings first.'
            });
        }
        if (securitySettings.pinLockedUntil && new Date(securitySettings.pinLockedUntil) > new Date()) {
            const mins = Math.ceil((new Date(securitySettings.pinLockedUntil) - new Date()) / (60 * 1000));
            return res.status(403).json({
                success: false,
                msg: `Transaction PIN is temporarily locked due to failed attempts. Try again in ${mins} minutes.`
            });
        }

        const authEmail = securitySettings.paymentAuthorizationEmail;
        const now = Date.now();

        // Rate Limit Check in MongoDB (max 5 requests in 10 mins, min 30s resend)
        const lastOtp = await PaymentSecurityOtp.findOne({
            email: authEmail,
            purpose: 'PAYMENT_AUTHORIZATION',
            isUsed: false
        }).sort({ createdAt: -1 });

        if (lastOtp) {
            if (now - new Date(lastOtp.lastResentAt).getTime() < 30 * 1000) {
                return res.status(429).json({ success: false, msg: 'Please wait 30 seconds before requesting another code.' });
            }
            if (lastOtp.resendCount >= 5 && (now - new Date(lastOtp.createdAt).getTime() < 10 * 60 * 1000)) {
                return res.status(429).json({ success: false, msg: 'Too many OTP requests. Please wait 10 minutes.' });
            }
        }

        const isBulk = Array.isArray(req.body.paymentIds) && req.body.paymentIds.length > 0;
        let paymentId = String(req.body.paymentId || 'PAY-DISBURSEMENT').trim();
        let amount = Number(req.body.amount || req.body.payableAmount || 0);
        let recipientId = String(req.body.recipientId || '').trim();
        let recipientName = String(req.body.recipientName || '').trim();
        let recipientType = String(req.body.recipientType || '').trim();
        let paymentPurpose = String(req.body.paymentPurpose || '').trim();

        if (isBulk) {
            paymentId = `BULK-PAYOUT-${Date.now()}`;
            recipientName = `${req.body.paymentIds.length} Recipients (Bulk Payout)`;
            recipientType = 'Bulk';
            paymentPurpose = paymentPurpose || `Bulk disbursement for ${req.body.paymentIds.length} pending payouts`;

            // Calculate server-verified total amount across requested paymentIds
            const payables = await computeRecipientPayables();
            const allItems = [
                ...(payables?.agents || []),
                ...(payables?.vendors || []),
                ...(payables?.deliveryPartners || []),
                ...(payables?.technicians || [])
            ];
            let calculatedTotal = 0;
            req.body.paymentIds.forEach(pid => {
                const found = allItems.find(i => String(i.paymentId) === String(pid) || String(i._id) === String(pid));
                if (found && (found.status === 'PENDING' || found.status === 'ELIGIBLE' || !found.status)) {
                    calculatedTotal += Number(found.payableAmount || found.amount || 0);
                }
            });
            amount = calculatedTotal > 0 ? calculatedTotal : amount;
        }

        const authorizationToken = crypto.randomBytes(32).toString('hex');

        // Create bound PaymentAuthorizationSession in MongoDB
        await PaymentAuthorizationSession.create({
            authorizationToken,
            userId: user._id,
            adminEmail: user.email,
            paymentAuthorizationEmail: authEmail,
            paymentId,
            recipientId,
            recipientName,
            recipientType,
            amount,
            paymentPurpose,
            accountDetails: { ...(req.body.accountDetails || {}), isBulk, paymentIds: req.body.paymentIds || [] },
            otpVerified: false,
            pinVerified: false,
            expiresAt: new Date(now + 10 * 60 * 1000) // 10 min validity
        });

        // Generate Secure 6-Digit OTP
        const otp = generateOtp();
        const otpHash = hashOtp(otp, authEmail, 'PAYMENT_AUTHORIZATION');

        await PaymentSecurityOtp.updateMany(
            { email: authEmail, purpose: 'PAYMENT_AUTHORIZATION', isUsed: false },
            { $set: { isUsed: true } }
        );

        await PaymentSecurityOtp.create({
            purpose: 'PAYMENT_AUTHORIZATION',
            userId: user._id,
            email: authEmail,
            otpHash,
            expiresAt: new Date(now + 2 * 60 * 1000), // 2 min expiry
            resendCount: (lastOtp?.resendCount || 0) + 1,
            lastResentAt: new Date(),
            sessionData: {
                authorizationToken,
                paymentId,
                amount,
                recipientId
            }
        });

        // Dispatch Email
        await sendPaymentSecurityEmail({
            toEmail: authEmail,
            purpose: 'PAYMENT_AUTHORIZATION',
            otp,
            metadata: {
                paymentId: isBulk ? `Bulk Payout (${req.body.paymentIds.length} items)` : paymentId,
                amount,
                recipientName: isBulk ? `${req.body.paymentIds.length} Selected Recipients` : recipientName,
                recipientType: isBulk ? 'Bulk Payout' : recipientType
            }
        });

        // Audit Trail
        await logPaymentAudit(req, 'otp_sent', paymentId, `Disbursement verification OTP sent to authorized email: ${authEmail}`, {
            paymentId,
            amount,
            recipient: recipientName,
            isBulk
        });

        res.json({
            success: true,
            msg: `A verification OTP has been sent to: ${maskEmail(authEmail)}.`,
            maskedEmail: maskEmail(authEmail),
            authorizationToken,
            verificationToken: authorizationToken,
            expiresIn: 120
        });

    } catch (err) {
        console.error('Error sending payment OTP:', err.message || err);
        if (authorizationToken) {
            await PaymentAuthorizationSession.deleteOne({ authorizationToken }).catch(() => {});
        }
        if (authEmail) {
            await PaymentSecurityOtp.deleteMany({ email: authEmail, purpose: 'PAYMENT_AUTHORIZATION', isUsed: false }).catch(() => {});
        }
        res.status(500).json({ success: false, message: 'Unable to send OTP email', msg: 'Unable to send OTP email. Please check SMTP configuration or try again.' });
    }
});

router.post('/verify-otp', auth, async (req, res) => {
    try {
        const { otp } = req.body;
        const token = req.body.authorizationToken || req.body.verificationToken;

        if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
            return res.status(400).json({ success: false, msg: 'Please provide a valid 6-digit numeric OTP code.' });
        }
        const cleanOtp = String(otp).trim();

        // 1. Look up PaymentAuthorizationSession in MongoDB
        const authSession = token ? await PaymentAuthorizationSession.findOne({ authorizationToken: token, isExecuted: false }) : null;
        if (!authSession) {
            return res.status(400).json({ success: false, msg: 'Invalid or expired payment authorization session. Please restart payment.' });
        }

        if (new Date() > new Date(authSession.expiresAt)) {
            return res.status(400).json({ success: false, msg: 'Payment authorization session has expired. Please restart payment.' });
        }

        // 2. Look up OTP in MongoDB
        const otpRecord = await PaymentSecurityOtp.findOne({
            email: authSession.paymentAuthorizationEmail,
            purpose: 'PAYMENT_AUTHORIZATION',
            isUsed: false,
            'sessionData.authorizationToken': authSession.authorizationToken
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ success: false, msg: 'No active OTP request found for this payment session. Please request a new code.' });
        }

        if (new Date() > new Date(otpRecord.expiresAt)) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new OTP.',
                msg: 'OTP has expired. Please request a new OTP.'
            });
        }

        if (otpRecord.attempts >= otpRecord.maxAttempts) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            await logPaymentAudit(req, 'otp_locked', authSession.paymentId, 'Payment OTP locked after maximum failed attempts');
            return res.status(403).json({ success: false, msg: 'Maximum verification attempts exceeded. Code invalidated.' });
        }

        const isMatch = verifyOtpHash(cleanOtp, authSession.paymentAuthorizationEmail, 'PAYMENT_AUTHORIZATION', otpRecord.otpHash);
        if (!isMatch) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            await logPaymentAudit(req, 'otp_failed', authSession.paymentId, `Incorrect Payment OTP (Attempt ${otpRecord.attempts}/${otpRecord.maxAttempts})`);
            return res.status(400).json({
                success: false,
                msg: `Invalid or expired OTP. ${otpRecord.maxAttempts - otpRecord.attempts} attempt(s) remaining.`
            });
        }

        // Single-use OTP invalidation
        otpRecord.isUsed = true;
        otpRecord.verifiedAt = new Date();
        await otpRecord.save();

        // Update Authorization Session in MongoDB
        authSession.otpVerified = true;
        authSession.otpVerifiedAt = new Date();
        await authSession.save();

        await logPaymentAudit(req, 'otp_verified', authSession.paymentId, `Payment authorization OTP verified successfully for ${authSession.paymentAuthorizationEmail}`);

        res.json({
            success: true,
            msg: 'Email OTP verified successfully. Please enter your Transaction PIN.',
            authorizationToken: authSession.authorizationToken,
            verificationToken: authSession.authorizationToken
        });

    } catch (err) {
        console.error('Error verifying payment OTP:', err);
        res.status(500).json({ success: false, msg: 'Server error verifying OTP' });
    }
});

// =========================================================================
// 4. SECURITY: TRANSACTION PIN STATUS & VERIFICATION
// =========================================================================
router.get('/pin-status', auth, async (req, res) => {
    try {
        const settings = await PaymentSecuritySettings.findOne().sort({ createdAt: -1 });
        const configured = Boolean(settings && settings.transactionPinHash);
        const emailConfigured = Boolean(settings && settings.paymentAuthorizationEmail && settings.emailVerified);
        const isLocked = Boolean(settings && settings.pinLockedUntil && new Date(settings.pinLockedUntil) > new Date());

        res.json({
            success: true,
            configured,
            emailConfigured,
            maskedEmail: settings?.paymentAuthorizationEmail ? maskEmail(settings.paymentAuthorizationEmail) : '',
            isLocked,
            lockedUntil: isLocked ? settings.pinLockedUntil : null
        });
    } catch (err) {
        res.status(500).json({ success: false, msg: 'Error checking PIN status' });
    }
});

router.post('/setup-pin', auth, async (req, res) => {
    try {
        const { pin, confirmPin } = req.body;
        if (!pin || !/^\d{4,6}$/.test(String(pin).trim())) {
            return res.status(400).json({ success: false, msg: 'PIN must be between 4 and 6 numeric digits.' });
        }
        if (String(pin).trim() !== String(confirmPin || '').trim()) {
            return res.status(400).json({ success: false, msg: 'PIN and Confirm PIN do not match.' });
        }

        const settings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!settings || !settings.paymentAuthorizationEmail) {
            return res.status(400).json({ success: false, msg: 'Verified payment authorization email required. Please configure email in System Settings first.' });
        }

        const hashed = await bcrypt.hash(String(pin).trim(), 10);
        settings.transactionPinHash = hashed;
        settings.failedPinAttempts = 0;
        settings.pinLockedUntil = null;
        settings.updatedBy = req.user.id || req.user._id;
        await settings.save();

        await logPaymentAudit(req, 'pin_setup', '', 'New Transaction PIN configured');

        res.json({ success: true, msg: 'Transaction PIN configured successfully.' });
    } catch (err) {
        console.error('Error configuring payment PIN:', err);
        res.status(500).json({ success: false, msg: 'Server error configuring payment PIN' });
    }
});

router.post('/verify-pin', auth, async (req, res) => {
    try {
        const { pin } = req.body;
        const token = req.body.authorizationToken || req.body.verificationToken;

        if (!pin || !/^\d{4,6}$/.test(String(pin).trim())) {
            return res.status(400).json({ success: false, msg: 'Transaction PIN must be numeric digits.' });
        }
        const cleanPin = String(pin).trim();

        // 1. Validate PaymentAuthorizationSession in MongoDB
        const authSession = token ? await PaymentAuthorizationSession.findOne({ authorizationToken: token, isExecuted: false }) : null;
        if (!authSession || new Date() > new Date(authSession.expiresAt) || !authSession.otpVerified) {
            return res.status(401).json({ success: false, msg: 'Session expired or Email OTP verification missing. Please restart verification.' });
        }

        // 2. Validate PIN against PaymentSecuritySettings in MongoDB
        const settings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!settings || !settings.transactionPinHash) {
            return res.status(400).json({ success: false, msg: 'Transaction PIN has not been configured. Please configure your PIN first in System Settings.' });
        }

        // Check Lockout
        if (settings.pinLockedUntil && new Date(settings.pinLockedUntil) > new Date()) {
            const minutesLeft = Math.ceil((new Date(settings.pinLockedUntil) - new Date()) / (60 * 1000));
            return res.status(403).json({ success: false, msg: `Transaction PIN is temporarily locked due to failed attempts. Try again in ${minutesLeft} minutes.` });
        }

        const isMatch = await bcrypt.compare(cleanPin, settings.transactionPinHash);
        if (!isMatch) {
            settings.failedPinAttempts = (settings.failedPinAttempts || 0) + 1;
            if (settings.failedPinAttempts >= 5) {
                settings.pinLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
                await settings.save();
                await logPaymentAudit(req, 'pin_failed', authSession.paymentId, 'Transaction PIN locked after 5 failed attempts');
                return res.status(403).json({ success: false, msg: 'Invalid Transaction PIN. Maximum attempts reached. Account locked for 15 minutes.' });
            }
            await settings.save();
            await logPaymentAudit(req, 'pin_failed', authSession.paymentId, `Transaction PIN attempt failed (${settings.failedPinAttempts}/5)`);
            return res.status(400).json({ success: false, msg: `Invalid Transaction PIN. ${5 - settings.failedPinAttempts} attempts remaining.` });
        }

        // Reset failed attempts on success
        settings.failedPinAttempts = 0;
        settings.pinLockedUntil = null;
        await settings.save();

        // Update Authorization Session in MongoDB
        authSession.pinVerified = true;
        authSession.pinVerifiedAt = new Date();
        await authSession.save();

        await logPaymentAudit(req, 'pin_verified', authSession.paymentId, 'Transaction PIN successfully verified');

        res.json({
            success: true,
            msg: 'Transaction PIN verified successfully. You may now process the disbursement.'
        });

    } catch (err) {
        console.error('Error verifying payment PIN:', err);
        res.status(500).json({ success: false, msg: 'Server error verifying payment PIN' });
    }
});

/**
 * Synchronize payment status, hold reasons, cancellation reasons, and transaction
 * details directly to underlying source collections (such as settlements) to guarantee
 * backend database as single source of truth across Admin and Vendor portals.
 */
async function syncPaymentSourceModel(payment, action, extra = {}) {
    if (!payment) return;
    try {
        const db = mongoose.connection.db;
        if (!db) return;

        const pId = String(payment.paymentId || '').trim();
        const sId = payment.sourceId ? String(payment.sourceId).trim() : '';
        const sRef = payment.sourceReference ? String(payment.sourceReference).trim() : '';
        const pIdSuffix = pId.replace(/^PAY-(?:VND-|ORD-VND-|AGT-|DEL-|TEC-)?/i, '').toLowerCase();
        const sRefSuffix = sRef.replace(/^SETTL-/i, '').toLowerCase();

        // Sync settlements collection
        const settlementOrQueries = [];
        if (sId) {
            settlementOrQueries.push({ _id: sId });
            if (mongoose.isValidObjectId(sId)) {
                settlementOrQueries.push({ _id: new mongoose.Types.ObjectId(sId) });
            }
        }
        if (pId) {
            settlementOrQueries.push({ paymentId: pId });
            if (pIdSuffix && pIdSuffix.length >= 4) {
                settlementOrQueries.push({ _id: new RegExp(pIdSuffix + '$', 'i') });
            }
        }
        if (sRef) {
            settlementOrQueries.push({ referenceNumber: sRef }, { settlementReference: sRef }, { referenceId: sRef });
            if (sRefSuffix && sRefSuffix.length >= 4) {
                settlementOrQueries.push({ _id: new RegExp(sRefSuffix + '$', 'i') });
            }
        }

        if (settlementOrQueries.length > 0) {
            let updateFields = { updatedAt: new Date() };
            if (action === 'PAID') {
                updateFields.status = 'Completed';
                updateFields.paymentStatus = 'PAID';
                updateFields.paidAt = payment.paymentDate || new Date();
                updateFields.paymentId = pId;
                updateFields.transactionReference = payment.transactionReference || extra.txnRef || '';
                updateFields.processedBy = payment.processedBy || extra.actorName || 'Admin';
            } else if (action === 'HOLD') {
                updateFields.status = 'Hold';
                updateFields.paymentStatus = 'HOLD';
                updateFields.holdReason = extra.reason || payment.holdReason || '';
                updateFields.heldBy = payment.heldBy || extra.actorName || 'Admin';
                updateFields.heldAt = payment.heldAt || new Date();
            } else if (action === 'RELEASE_HOLD') {
                updateFields.status = 'Pending';
                updateFields.paymentStatus = 'PENDING';
                updateFields.holdReason = '';
            } else if (action === 'CANCEL') {
                updateFields.status = 'Cancelled';
                updateFields.paymentStatus = 'CANCELLED';
                updateFields.cancellationReason = extra.reason || payment.cancellationReason || '';
                updateFields.cancelledBy = payment.cancelledBy || extra.actorName || 'Admin';
                updateFields.cancelledAt = payment.cancelledAt || new Date();
            }

            const settlResult = await db.collection('settlements').updateMany(
                { $or: settlementOrQueries },
                { $set: updateFields }
            );

            // If matched, ensure payment record has sourceModel and sourceId linked
            if (settlResult.matchedCount > 0 && !payment.sourceId) {
                const matchedDoc = await db.collection('settlements').findOne({ $or: settlementOrQueries });
                if (matchedDoc) {
                    payment.sourceModel = 'Settlement';
                    payment.sourceId = String(matchedDoc._id);
                    if (!payment.sourceReference) payment.sourceReference = `SETTL-${String(matchedDoc._id).slice(-6).toUpperCase()}`;
                    await payment.save();
                }
            }
        }

        // Sync orders collection if this payment is associated with an order
        const orderOrQueries = [];
        if (payment.sourceModel === 'Order' || /ORD/i.test(pId) || /ORD/i.test(sRef)) {
            if (sId) {
                orderOrQueries.push({ _id: sId });
                if (mongoose.isValidObjectId(sId)) {
                    orderOrQueries.push({ _id: new mongoose.Types.ObjectId(sId) });
                }
            }
            if (sRef) {
                orderOrQueries.push({ order_number: sRef }, { id: sRef });
            }
            if (pIdSuffix && pIdSuffix.length >= 4) {
                if (mongoose.isValidObjectId(pIdSuffix)) {
                    orderOrQueries.push({ _id: new mongoose.Types.ObjectId(pIdSuffix) });
                }
                orderOrQueries.push({ order_number: new RegExp(pIdSuffix + '$', 'i') });
                orderOrQueries.push({ id: new RegExp(pIdSuffix + '$', 'i') });
            }
        }
        if (orderOrQueries.length > 0) {
            let orderUpdate = { updatedAt: new Date() };
            if (action === 'PAID') {
                orderUpdate.vendorPaymentStatus = 'PAID';
            } else if (action === 'HOLD') {
                orderUpdate.vendorPaymentStatus = 'HOLD';
                orderUpdate.vendorHoldReason = extra.reason || payment.holdReason || '';
            } else if (action === 'RELEASE_HOLD') {
                orderUpdate.vendorPaymentStatus = 'PENDING';
                orderUpdate.vendorHoldReason = '';
            } else if (action === 'CANCEL') {
                orderUpdate.vendorPaymentStatus = 'CANCELLED';
                orderUpdate.vendorCancellationReason = extra.reason || payment.cancellationReason || '';
            }
            await db.collection('orders').updateMany(
                { $or: orderOrQueries },
                { $set: orderUpdate }
            ).catch(() => {});
        }
    } catch (syncErr) {
        console.error('Error synchronizing payment with source model:', syncErr);
    }
}

// =========================================================================
// 5. ATOMIC PAYMENT PROCESSING & IDEMPOTENCY LOCKING (SECTIONS 9, 10, 14)
// =========================================================================
router.post('/process', auth, async (req, res) => {
    try {
        const { paymentId, idempotencyKey, notes } = req.body;
        const token = req.body.authorizationToken || req.body.verificationToken;

        if (!paymentId) {
            return res.status(400).json({ success: false, msg: 'Payment ID is required.' });
        }

        // Mandatory Two-Factor Server-Side Authorization Session Validation
        const authSession = token ? await PaymentAuthorizationSession.findOne({ authorizationToken: token }) : null;
        if (!authSession || new Date() > new Date(authSession.expiresAt) || !authSession.otpVerified || !authSession.pinVerified) {
            return res.status(401).json({
                success: false,
                msg: 'Unauthorized: Dual-verification required. Complete BOTH Email OTP and Transaction PIN verification before disbursement.'
            });
        }

        if (authSession.isExecuted) {
            return res.status(400).json({
                success: false,
                msg: 'This payment authorization session has already been executed.'
            });
        }

        // Parameter Integrity Check (Requirement 6: Invalidate if parameters changed)
        const reqAmount = req.body.amount !== undefined ? Number(req.body.amount) : (req.body.payableAmount !== undefined ? Number(req.body.payableAmount) : null);
        if (reqAmount !== null && Math.abs(reqAmount - Number(authSession.amount)) > 0.01) {
            authSession.isExecuted = true;
            await authSession.save();
            await logPaymentAudit(req, 'payment_failed', paymentId, `Disbursement amount changed after authorization. Expected ₹${authSession.amount}, received ₹${reqAmount}`);
            return res.status(400).json({
                success: false,
                msg: 'Security Alert: Payment amount was changed after verification. Authorization invalidated. Please re-verify.'
            });
        }

        if (req.body.recipientId && String(req.body.recipientId) !== String(authSession.recipientId)) {
            authSession.isExecuted = true;
            await authSession.save();
            await logPaymentAudit(req, 'payment_failed', paymentId, 'Disbursement recipient changed after authorization');
            return res.status(400).json({
                success: false,
                msg: 'Security Alert: Payment recipient was changed after verification. Authorization invalidated. Please re-verify.'
            });
        }

        // 1. ATOMIC LOCKING & IDEMPOTENCY CHECK
        // Check current status and transition to PROCESSING atomically
        const idFilter = [{ paymentId }];
        if (mongoose.isValidObjectId(paymentId)) idFilter.push({ _id: paymentId });

        let payment = await Payment.findOneAndUpdate(
            {
                $or: idFilter,
                status: { $in: ['PENDING', 'ELIGIBLE', 'HOLD'] }
            },
            {
                $set: { status: 'PROCESSING' }
            },
            { new: true }
        );

        if (!payment) {
            const existingPaid = await Payment.findOne({ $or: idFilter }).lean();
            if (existingPaid) {
                if (existingPaid.status === 'PAID') {
                    return res.status(400).json({ success: false, msg: 'This disbursement has already been processed.' });
                }
                if (existingPaid.status === 'CANCELLED') {
                    return res.status(400).json({ success: false, msg: 'Cannot process a cancelled disbursement.' });
                }
                if (existingPaid.status === 'PROCESSING') {
                    return res.status(400).json({ success: false, msg: 'Payment is currently being processed by another transaction. Please wait.' });
                }
            } else {
                // If not yet persisted, verify and match against real operational database payables
                const payables = await computeRecipientPayables();
                const allItems = [
                    ...(payables?.agents || []),
                    ...(payables?.vendors || []),
                    ...(payables?.deliveryPartners || []),
                    ...(payables?.technicians || [])
                ];
                const matched = allItems.find(i => i.paymentId === paymentId || String(i._id) === String(paymentId));
                if (matched) {
                    payment = new Payment({
                        paymentId,
                        paymentType: 'paid',
                        paymentCategory: inferPaymentCategory(matched.recipientType),
                        recipientName: matched.recipientName,
                        recipientType: matched.recipientType,
                        recipientId: matched.recipientId,
                        amount: matched.payableAmount,
                        paymentPurpose: matched.paymentPurpose,
                        sourceReference: matched.sourceReference,
                        sourceModel: matched.sourceModel || (matched.recipientType === 'Vendor' ? 'Settlement' : undefined),
                        sourceId: matched.sourceId ? String(matched.sourceId) : undefined,
                        status: 'PROCESSING'
                    });
                    await payment.save();
                } else if (authSession && authSession.amount > 0) {
                    // Fallback to authorized session parameters
                    payment = new Payment({
                        paymentId,
                        paymentType: 'paid',
                        paymentCategory: inferPaymentCategory(authSession.recipientType || 'Vendor'),
                        recipientName: authSession.recipientName || 'Authorized Recipient',
                        recipientType: authSession.recipientType || 'Vendor',
                        recipientId: authSession.recipientId || paymentId,
                        amount: authSession.amount,
                        paymentPurpose: notes || 'Authorized financial disbursement',
                        sourceReference: `TXN-${paymentId}`,
                        status: 'PROCESSING'
                    });
                    await payment.save();
                }
            }

            if (!payment) {
                return res.status(404).json({ success: false, msg: 'Disbursement record not found.' });
            }
        }

        // 2. SERVER-SIDE AMOUNT VERIFICATION (Requirement 10: Never trust frontend amount)
        let verifiedAmount = Number(payment.amount || 0);
        if (verifiedAmount <= 0) {
            payment.status = 'FAILED';
            payment.failureReason = 'Invalid server-side disbursement amount';
            await payment.save();
            return res.status(400).json({ success: false, msg: 'Payment amount must be greater than zero.' });
        }

        const txnRef = `TXN-FIC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const actorName = req.user.name || 'Super Admin';
        const actorId = req.user.id || req.user._id;

        // 3. FINALIZE PAYMENT STATE (Terminal State PAID)
        payment.status = 'PAID';
        payment.amount = verifiedAmount;
        payment.paymentDate = new Date();
        payment.transactionReference = txnRef;
        payment.idempotencyKey = idempotencyKey || txnRef;
        payment.processedBy = actorName;
        payment.processedById = actorId;
        if (notes) payment.notes = notes;

        await payment.save();

        // Invalidate Authorization Session in MongoDB
        authSession.isExecuted = true;
        authSession.executedAt = new Date();
        await authSession.save();

        // Sync with source model (Settlement / Order) directly in database
        await syncPaymentSourceModel(payment, 'PAID', { txnRef, actorName });

        // Log Immutable Audit Trail
        await logPaymentAudit(req, 'payment_processed', paymentId, `Disbursement of ₹${verifiedAmount} to ${payment.recipientName} (${payment.recipientType}) completed`, {
            transactionReference: txnRef,
            amount: verifiedAmount,
            recipient: payment.recipientName,
            recipientType: payment.recipientType,
            purpose: payment.paymentPurpose
        });

        // Real-Time Broadcast
        emitPaymentRealtime(req, 'processed', payment.toObject());

        res.json({
            success: true,
            msg: `Payment of ₹${verifiedAmount.toLocaleString()} to ${payment.recipientName} processed successfully.`,
            payment: {
                paymentId: payment.paymentId,
                transactionReference: txnRef,
                recipientName: payment.recipientName,
                recipientType: payment.recipientType,
                amount: verifiedAmount,
                status: 'PAID',
                paymentDate: payment.paymentDate,
                processedBy: payment.processedBy
            }
        });

    } catch (err) {
        console.error('Error processing disbursement:', err);
        res.status(500).json({ success: false, msg: 'Server error processing disbursement.' });
    }
});

// Alias for bulk-send-otp
router.post('/bulk-send-otp', auth, async (req, res) => {
    // Forward to existing send-otp handler logic
    req.url = '/send-otp';
    return router.handle(req, res);
});

// =========================================================================
// 5B. BULK PAYMENT PROCESSING (REQUIREMENTS 2, 5, 9, 10, 13)
// =========================================================================
router.post('/bulk-process', auth, async (req, res) => {
    try {
        const { paymentIds, idempotencyKey } = req.body;
        const token = req.body.authorizationToken || req.body.verificationToken;

        if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
            return res.status(400).json({ success: false, msg: 'At least one payment ID is required for bulk processing.' });
        }

        // 1. Mandatory Two-Factor Server-Side Authorization Session Validation
        const authSession = token ? await PaymentAuthorizationSession.findOne({ authorizationToken: token }) : null;
        if (!authSession || new Date() > new Date(authSession.expiresAt) || !authSession.otpVerified || !authSession.pinVerified) {
            return res.status(401).json({
                success: false,
                msg: 'Unauthorized: Dual-verification required. Complete BOTH Email OTP and Transaction PIN verification before disbursement.'
            });
        }

        if (authSession.isExecuted) {
            return res.status(400).json({
                success: false,
                msg: 'This payment authorization session has already been executed.'
            });
        }

        // 2. Pre-fetch real operational database payables to match and validate
        const payables = await computeRecipientPayables();
        const allItems = [
            ...(payables?.agents || []),
            ...(payables?.vendors || []),
            ...(payables?.deliveryPartners || []),
            ...(payables?.technicians || [])
        ];
        const payablesMap = new Map();
        allItems.forEach(item => {
            if (item.paymentId) payablesMap.set(String(item.paymentId), item);
            if (item._id) payablesMap.set(String(item._id), item);
        });

        const actorName = req.user?.name || 'Super Admin';
        const actorId = req.user?.id || req.user?._id;

        const results = [];
        let totalDisbursed = 0;
        let successCount = 0;
        let failedCount = 0;

        for (const paymentId of paymentIds) {
            const cleanId = String(paymentId).trim();
            if (!cleanId) continue;

            const idFilter = [{ paymentId: cleanId }];
            if (mongoose.isValidObjectId(cleanId)) idFilter.push({ _id: cleanId });

            // Atomic Locking: Transition to PROCESSING atomically
            let payment = await Payment.findOneAndUpdate(
                {
                    $or: idFilter,
                    status: { $in: ['PENDING', 'ELIGIBLE', 'HOLD'] }
                },
                {
                    $set: { status: 'PROCESSING' }
                },
                { new: true }
            );

            if (!payment) {
                const existing = await Payment.findOne({ $or: idFilter }).lean();
                if (existing) {
                    results.push({
                        paymentId: cleanId,
                        recipientName: existing.recipientName || 'Recipient',
                        amount: existing.amount || 0,
                        status: 'FAILED',
                        reason: `Payment is already ${existing.status} and cannot be processed.`
                    });
                    failedCount++;
                    continue;
                }

                // If not yet in Payment collection, check computed payables
                const matched = payablesMap.get(cleanId);
                if (matched && (matched.status === 'PENDING' || matched.status === 'ELIGIBLE' || !matched.status)) {
                    payment = new Payment({
                        paymentId: cleanId,
                        paymentType: 'paid',
                        paymentCategory: inferPaymentCategory(matched.recipientType),
                        recipientName: matched.recipientName,
                        recipientType: matched.recipientType,
                        recipientId: matched.recipientId,
                        amount: matched.payableAmount,
                        paymentPurpose: matched.paymentPurpose,
                        sourceReference: matched.sourceReference,
                        status: 'PROCESSING'
                    });
                    await payment.save();
                } else {
                    results.push({
                        paymentId: cleanId,
                        recipientName: matched?.recipientName || 'Unknown',
                        amount: matched?.payableAmount || 0,
                        status: 'FAILED',
                        reason: matched ? `Payment status is ${matched.status} (must be PENDING).` : 'Disbursement record not found.'
                    });
                    failedCount++;
                    continue;
                }
            }

            // Verify amount
            const verifiedAmount = Number(payment.amount || 0);
            if (verifiedAmount <= 0) {
                payment.status = 'FAILED';
                payment.failureReason = 'Invalid server-side disbursement amount';
                await payment.save();
                results.push({
                    paymentId: cleanId,
                    recipientName: payment.recipientName,
                    amount: 0,
                    status: 'FAILED',
                    reason: 'Payment amount must be greater than zero.'
                });
                failedCount++;
                continue;
            }

            // Finalize Payment state to PAID
            const txnRef = `TXN-FIC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            payment.status = 'PAID';
            payment.amount = verifiedAmount;
            payment.paymentDate = new Date();
            payment.transactionReference = txnRef;
            payment.idempotencyKey = txnRef;
            payment.processedBy = actorName;
            payment.processedById = actorId;

            await payment.save();

            // Sync with source model (e.g. settlements)
            if (payment.sourceModel === 'Settlement' && payment.sourceId) {
                await mongoose.connection.db.collection('settlements').updateOne(
                    { _id: new mongoose.Types.ObjectId(payment.sourceId) },
                    { $set: { status: 'Completed', updatedAt: new Date() } }
                ).catch(() => {});
            }

            // Log Immutable Audit Trail
            await logPaymentAudit(req, 'payment_processed', cleanId, `Bulk disbursement of ₹${verifiedAmount} to ${payment.recipientName} (${payment.recipientType}) completed`, {
                transactionReference: txnRef,
                amount: verifiedAmount,
                recipient: payment.recipientName,
                recipientType: payment.recipientType,
                isBulk: true
            }).catch(() => {});

            // Real-Time Broadcast
            emitPaymentRealtime(req, 'processed', payment.toObject());

            // Sync with source model (Settlement / Order)
            await syncPaymentSourceModel(payment, 'PAID', { txnRef, actorName });

            totalDisbursed += verifiedAmount;
            successCount++;

            results.push({
                paymentId: cleanId,
                recipientName: payment.recipientName,
                recipientType: payment.recipientType,
                amount: verifiedAmount,
                status: 'SUCCESS',
                transactionReference: txnRef,
                paymentDate: payment.paymentDate
            });
        }

        // Invalidate Authorization Session in MongoDB
        authSession.isExecuted = true;
        authSession.executedAt = new Date();
        await authSession.save();

        res.json({
            success: true,
            msg: `Bulk payment completed: ${successCount} successful, ${failedCount} failed. Total disbursed: ₹${totalDisbursed.toLocaleString('en-IN')}`,
            summary: {
                total: paymentIds.length,
                successful: successCount,
                failed: failedCount,
                totalDisbursed
            },
            results
        });

    } catch (err) {
        console.error('Bulk payment processing error:', err);
        res.status(500).json({ success: false, msg: `Bulk payment processing failed: ${err.message}` });
    }
});

// =========================================================================
// 5C. DETAILED PAYMENT BREAKDOWN STATEMENT (REQUIREMENT 7)
// =========================================================================
router.get('/breakdown/:paymentId', auth, async (req, res) => {
    try {
        const { paymentId } = req.params;
        const cleanId = String(paymentId).trim();

        // 1. Check database Payment record
        const idFilter = [{ paymentId: cleanId }];
        if (mongoose.isValidObjectId(cleanId)) idFilter.push({ _id: cleanId });

        const pRecord = await Payment.findOne({ $or: idFilter }).lean();

        // 2. Check computed payables
        const payables = await computeRecipientPayables();
        const allItems = [
            ...(payables?.agents || []),
            ...(payables?.vendors || []),
            ...(payables?.deliveryPartners || []),
            ...(payables?.technicians || [])
        ];
        const matched = allItems.find(i => String(i.paymentId) === cleanId || String(i._id) === cleanId);

        if (!pRecord && !matched) {
            return res.status(404).json({ success: false, msg: 'Payment record not found.' });
        }

        const effective = pRecord || matched;
        const db = mongoose.connection.db;

        // ─── CATEGORY LABEL HELPER ───────────────────────────────────────────
        const getCategoryLabel = (type) => {
            const map = { 'Food': 'Food Order', 'Services': 'Service Booking', 'Stay': 'Stay Booking', 'Travel': 'Travel Booking', 'Job': 'Job Application', 'Daily Needs': 'Daily Needs Order', 'Products': 'Product Order' };
            return map[type] || type || 'Product Order';
        };

        // ─── RESOLVE SETTLEMENT ───────────────────────────────────────────────
        const allSettlements = await db.collection('settlements').find({}).toArray();
        const sourceRef = effective.sourceId || effective.sourceReference || '';
        const settlementRecord = allSettlements.find(s =>
            String(s._id) === String(sourceRef) ||
            String(s._id) === cleanId ||
            `PAY-VND-${String(s._id).slice(-6).toUpperCase()}` === cleanId ||
            `SETTL-${String(s._id).slice(-6).toUpperCase()}` === (effective.orderReference || effective.sourceReference || '')
        ) || null;

        // ─── RESOLVE VENDOR ───────────────────────────────────────────────────
        let vId = settlementRecord?.vendorId || null;
        let vendorRecord = null;
        if (vId) {
            if (mongoose.isValidObjectId(vId)) vendorRecord = await db.collection('vendors').findOne({ _id: new mongoose.Types.ObjectId(vId) });
            if (!vendorRecord) vendorRecord = await db.collection('vendors').findOne({ _id: vId });
            if (!vendorRecord && mongoose.isValidObjectId(vId)) {
                const u = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(vId) });
                if (u) vendorRecord = { ...u, businessName: u.businessName || u.name, vendorType: u.vendorType || u.category || 'General' };
            }
            if (!vendorRecord) {
                const u = await db.collection('users').findOne({ _id: vId });
                if (u) vendorRecord = { ...u, businessName: u.businessName || u.name, vendorType: u.vendorType || u.category || 'General' };
            }
        }

        // ─── FETCH ORDERS ─────────────────────────────────────────────────────
        let rawOrders = [];
        if (vId) {
            const orClauses = [{ vendorId: vId }, { vendor_id: vId }];
            if (mongoose.isValidObjectId(vId)) {
                orClauses.push({ vendorId: new mongoose.Types.ObjectId(vId) });
                orClauses.push({ vendor_id: new mongoose.Types.ObjectId(vId) });
            }
            rawOrders = await db.collection('orders').find({ $or: orClauses }).sort({ created_at: -1 }).toArray();
        }
        if (settlementRecord?.ordersIncluded?.length) {
            const incSet = new Set(settlementRecord.ordersIncluded.map(String));
            rawOrders = rawOrders.filter(o => incSet.has(String(o._id)) || incSet.has(o.order_number) || incSet.has(o.id));
        }

        // ─── MAP TRANSACTIONS ─────────────────────────────────────────────────
        const rawRate = settlementRecord?.commissionRate !== undefined ? settlementRecord.commissionRate : (effective.commissionRate !== undefined ? effective.commissionRate : 0);
        const commRateNum = parseFloat(String(rawRate).replace(/[^0-9.-]/g, '')) || 0;
        const transactions = rawOrders.map(o => {
            const grossAmt = Number(o.finalAmount || o.totalAmount || o.amount || 0);
            const commAmt = Math.round(grossAmt * (commRateNum / 100)) || 0;
            const refundAmt = Number(o.refundAmount || 0);
            const eligible = Math.max(0, grossAmt - commAmt - refundAmt);
            const items = Array.isArray(o.items) ? o.items : [];
            const primaryItem = items[0];
            const productName = primaryItem?.name || o.product_details || 'Not specified';
            const quantity = items.reduce((sum, it) => sum + Number(it.quantity || 1), 0) || 1;
            const unitPrice = primaryItem?.price || (quantity > 0 ? Math.round(grossAmt / quantity) : grossAmt);
            return {
                orderId: o.order_number || o.id || `ORD-${String(o._id).slice(-6).toUpperCase()}`,
                transactionId: o.transactionId || `TXN_${o.order_number || String(o._id).slice(-6).toUpperCase()}`,
                orderDate: o.created_at || o.createdAt || null,
                productName,
                category: o.type || o.category || 'Products',
                categoryLabel: getCategoryLabel(o.type || o.category),
                quantity,
                unitPrice,
                grossAmount: grossAmt,
                discount: Number(o.discount || 0),
                tax: Number(o.tax || 0),
                deliveryCharge: Number(o.deliveryCharge || o.delivery_charge || 0),
                commission: commAmt,
                fees: 0,
                refundAmount: refundAmt,
                eligibleAmount: eligible,
                orderStatus: o.status || 'Unknown',
                paymentStatus: o.paymentStatus || o.payment_status || 'Unknown',
                paymentMethod: o.paymentMethod || o.payment_method || 'Not specified',
                items,
                appointmentDate: o.appointmentDate || null,
                doctorName: o.doctorName || null,
                tableNumber: o.tableNumber || null,
                roomNumber: o.roomNumber || null,
                candidateEmail: o.candidateEmail || null
            };
        });

        // ─── PRODUCT SALES BREAKDOWN ──────────────────────────────────────────
        const productSalesMap = new Map();
        for (const tx of transactions) {
            const key = `${tx.productName}__${tx.category}`;
            if (!productSalesMap.has(key)) productSalesMap.set(key, { productName: tx.productName, category: tx.category, categoryLabel: tx.categoryLabel, quantitySold: 0, totalSales: 0 });
            const e = productSalesMap.get(key);
            e.quantitySold += tx.quantity;
            e.totalSales += tx.grossAmount;
        }
        const productSales = Array.from(productSalesMap.values());

        // ─── TRANSACTION SUMMARY KPIs ─────────────────────────────────────────
        const completedSet = new Set(['delivered', 'completed', 'done', 'Delivered', 'Completed', 'Order Received', 'Confirmed']);
        const cancelledSet = new Set(['cancelled', 'Cancelled', 'rejected', 'Rejected']);
        const refundedSet = new Set(['refunded', 'Refunded']);
        const totalOrders = transactions.length;
        const completedOrders = transactions.filter(t => completedSet.has(t.orderStatus)).length;
        const cancelledOrders = transactions.filter(t => cancelledSet.has(t.orderStatus)).length;
        const refundedOrders = transactions.filter(t => refundedSet.has(t.orderStatus)).length;
        const totalRefunds = transactions.reduce((sum, t) => sum + (Number(t.refundAmount) || 0), 0);
        const totalCommission = transactions.reduce((sum, t) => sum + (Number(t.commission) || 0), 0);

        const gross = Number(effective.grossAmount || effective.amount || effective.payableAmount || 0);
        const payable = Number(effective.payableAmount || effective.amount || 0);
        const commissionAmount = Math.max(0, gross - payable);

        const transactionSummary = { totalOrders, completedOrders, cancelledOrders, refundedOrders, grossSales: transactions.reduce((sum, t) => sum + (Number(t.grossAmount) || 0), 0), commission: totalCommission, fees: 0, refunds: totalRefunds, adjustments: 0, finalNetPayable: payable };
        const auditCalculation = { eligibleTransactionsCount: totalOrders, grossTransactionValue: gross, commissionRate: `${commRateNum}%`, commissionAmount, applicableFees: 0, refunds: totalRefunds, adjustments: 0, finalNetPayable: payable };

        // ─── SETTLEMENT INFO ──────────────────────────────────────────────────
        let orderSettlement = {
            relatedOrderId: effective.orderReference || effective.sourceReference || 'Not available',
            orderDate: effective.lastUpdated ? new Date(effective.lastUpdated).toLocaleDateString('en-IN') : 'Not available',
            orderItems: effective.eligibleOrder || effective.eligibleWork || effective.completedWork || 'Not available',
            quantity: effective.quantity || 1,
            orderAmount: gross,
            settlementReference: effective.sourceReference || effective.orderReference || 'Not available',
            settlementDate: effective.paymentDate || effective.lastUpdated || 'Not available',
            settlementPeriod: 'Not available',
            paymentId: effective.paymentId || cleanId,
            paymentMethod: effective.paymentMethod || 'Bank Transfer',
            txnReference: effective.transactionReference || 'Not available',
            status: effective.status || 'PENDING'
        };
        if (settlementRecord) {
            const sId = String(settlementRecord._id);
            const sDate = settlementRecord.settlementDate ? new Date(settlementRecord.settlementDate).toLocaleDateString('en-IN') : 'Not available';
            orderSettlement = {
                relatedOrderId: `SETTL-${sId.slice(-6).toUpperCase()}`,
                orderDate: settlementRecord.settlementDate ? new Date(settlementRecord.settlementDate).toLocaleDateString('en-IN') : new Date(settlementRecord.createdAt).toLocaleDateString('en-IN'),
                orderItems: rawOrders.length > 0 ? `${rawOrders.length} verified orders` : 'Settlement batch',
                quantity: rawOrders.length || 1,
                orderAmount: settlementRecord.grossAmount || gross,
                settlementReference: settlementRecord.referenceNumber || settlementRecord.settlementReference || `SETTL-${sId.slice(-6).toUpperCase()}`,
                settlementDate: sDate,
                settlementPeriod: settlementRecord.settlementPeriod || `${new Date(settlementRecord.createdAt).toLocaleDateString('en-IN')} – ${sDate}`,
                paymentId: effective.paymentId || cleanId,
                paymentMethod: effective.paymentMethod || 'Bank Transfer',
                txnReference: effective.transactionReference || 'Not available',
                status: settlementRecord.status || effective.status || 'PENDING'
            };
        }

        // ─── VENDOR INFO ──────────────────────────────────────────────────────
        const vendorInfo = {
            recipientName: vendorRecord?.name || effective.recipientName || settlementRecord?.vendorBusinessName || 'Not available',
            recipientId: vId ? `VND-${String(vId).slice(-6).toUpperCase()}` : (effective.recipientId || 'Not available'),
            recipientType: effective.recipientType || 'Vendor',
            businessName: vendorRecord?.businessName || vendorRecord?.name || settlementRecord?.vendorBusinessName || effective.businessName || 'Not available',
            businessType: vendorRecord?.vendorType || vendorRecord?.category || effective.businessType || 'General',
            email: vendorRecord?.email || effective.recipientEmail || 'Not available',
            phone: vendorRecord?.phone || effective.recipientPhone || 'Not available',
            state: vendorRecord?.state || vendorRecord?.territory?.state || 'Not available',
            district: vendorRecord?.district || vendorRecord?.territory?.district || 'Not available',
            division: vendorRecord?.division || vendorRecord?.territory?.division || 'Not available',
            pincode: vendorRecord?.pincode || vendorRecord?.territory?.pincode || 'Not available',
            address: vendorRecord?.address || vendorRecord?.fullAddress || 'Not available',
            bankDetails: {
                accountHolder: vendorRecord?.bankDetails?.accountHolder || vendorRecord?.name || effective.bankDetails?.accountHolder || 'Not available',
                accountNumber: vendorRecord?.bankDetails?.accountNumber ? maskAccountNumber(vendorRecord.bankDetails.accountNumber) : (effective.bankDetails?.accountNumber || 'Not Provided'),
                ifsc: vendorRecord?.bankDetails?.ifscCode || vendorRecord?.bankDetails?.ifsc || effective.bankDetails?.ifsc || 'Not available',
                bankName: vendorRecord?.bankDetails?.bankName || effective.bankDetails?.bankName || 'Direct Transfer'
            }
        };

        res.json({
            success: true,
            breakdown: {
                summary: {
                    paymentId: effective.paymentId || cleanId,
                    receiptId: effective.receiptNumber || (effective.status === 'PAID' ? `RCP-${cleanId.replace(/[^A-Za-z0-9]/g, '').slice(-8)}` : 'Not available'),
                    transactionReference: effective.transactionReference || 'Not available',
                    status: effective.status || 'PENDING',
                    paymentDate: effective.paymentDate ? new Date(effective.paymentDate).toLocaleDateString('en-IN') : 'Not available',
                    paymentTime: effective.paymentDate ? new Date(effective.paymentDate).toLocaleTimeString('en-IN') : 'Not available',
                    paymentAmount: payable,
                    amount: payable,
                    paymentMethod: effective.paymentMethod || 'Bank Transfer',
                    paymentPurpose: effective.paymentPurpose || 'Verified service compensation'
                },
                vendor: vendorInfo,
                recipient: { name: vendorInfo.recipientName, recipientId: vendorInfo.recipientId, recipientType: vendorInfo.recipientType, businessName: vendorInfo.businessName, businessType: vendorInfo.businessType, phone: vendorInfo.phone, email: vendorInfo.email },
                settlement: orderSettlement,
                transactionSummary,
                auditCalculation,
                productSales,
                transactions,
                calculation: { grossAmount: gross, commissionRate: effective.commissionRate !== undefined ? `${effective.commissionRate}` : '0%', commissionBasis: effective.commissionBasis || 'Platform Agreement', commissionAmount, vendorPayableAmount: payable, applicableFees: 0, finalPayableAmount: payable },
                orderSettlement
            }
        });

    } catch (err) {
        console.error('Payment breakdown retrieval error:', err);
        res.status(500).json({ success: false, msg: 'Failed to retrieve payment breakdown statement' });
    }
});




// =========================================================================
// 6. HOLD & RELEASE PAYMENT (SECTION 11 & 13)
// =========================================================================
router.post('/hold', auth, async (req, res) => {
    try {
        const { paymentId, reason, recipientId, recipientType, recipientName, amount, payableAmount, paymentPurpose, sourceReference, sourceId, sourceModel } = req.body;

        if (!paymentId) {
            return res.status(400).json({ success: false, msg: 'Payment ID is required.' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, msg: 'A reason for placing payment on hold is mandatory.' });
        }

        const cleanPId = String(paymentId).trim();
        const idFilter = [{ paymentId: cleanPId }];
        if (mongoose.isValidObjectId(cleanPId)) idFilter.push({ _id: cleanPId });
        if (sourceReference) idFilter.push({ sourceReference: String(sourceReference).trim() });
        if (sourceId) idFilter.push({ sourceId: String(sourceId).trim() });
        const pSuffix = cleanPId.replace(/^PAY-(?:VND-|ORD-VND-|ORD-|AGT-|DEL-|TEC-)?/i, '').toLowerCase();
        if (pSuffix.length >= 4) idFilter.push({ paymentId: new RegExp(pSuffix + '$', 'i') });

        let payment = await Payment.findOne({ $or: idFilter });

        if (!payment) {
            // Auto-persist operational payable if not yet in database
            payment = new Payment({
                paymentId: cleanPId,
                paymentType: 'paid',
                paymentCategory: inferPaymentCategory(recipientType),
                recipientName: recipientName || 'Payable Recipient',
                recipientType: recipientType || 'Vendor',
                recipientId: recipientId || cleanPId,
                amount: amount || payableAmount || 0,
                paymentPurpose: paymentPurpose || 'Operational Disbursement',
                sourceReference: sourceReference || cleanPId,
                sourceId: sourceId ? String(sourceId) : undefined,
                sourceModel: sourceModel || (recipientType === 'Vendor' ? 'Settlement' : undefined),
                status: 'PENDING'
            });
        }

        if (payment.status === 'PAID') {
            return res.status(400).json({ success: false, msg: 'Cannot hold a payment that has already been processed.' });
        }
        if (payment.status === 'CANCELLED') {
            return res.status(400).json({ success: false, msg: 'Cannot hold a cancelled payment.' });
        }

        const previousStatus = payment.status;
        payment.status = 'HOLD';
        payment.holdReason = reason.trim();
        payment.heldBy = req.user.name || 'Administrator';
        payment.heldById = req.user.id || req.user._id;
        payment.heldAt = new Date();
        if (sourceId && !payment.sourceId) payment.sourceId = String(sourceId);
        if (sourceModel && !payment.sourceModel) payment.sourceModel = sourceModel;
        if (sourceReference && !payment.sourceReference) payment.sourceReference = sourceReference;

        payment.previousHistory = payment.previousHistory || [];
        payment.previousHistory.push({
            action: 'HOLD',
            by: payment.heldBy,
            date: payment.heldAt,
            reason: reason.trim(),
            previousStatus
        });

        await payment.save();

        // Sync with source model (Settlement / Order) in database
        await syncPaymentSourceModel(payment, 'HOLD', { reason: reason.trim(), actorName: payment.heldBy });

        await logPaymentAudit(req, 'payment_held', payment.paymentId, `Payment ${payment.paymentId} placed on HOLD: ${reason.trim()}`, {
            reason: reason.trim(),
            heldBy: payment.heldBy,
            previousStatus
        });

        emitPaymentRealtime(req, 'held', payment.toObject());

        res.json({
            success: true,
            msg: `Payment ${payment.paymentId} placed on hold.`,
            payment: {
                _id: payment._id,
                paymentId: payment.paymentId,
                status: 'HOLD',
                holdReason: payment.holdReason,
                heldBy: payment.heldBy,
                heldAt: payment.heldAt
            }
        });

    } catch (err) {
        console.error('Error holding payment:', err);
        res.status(500).json({ success: false, msg: 'Server error holding payment.' });
    }
});

router.post('/release-hold', auth, async (req, res) => {
    try {
        const { paymentId, reason, sourceReference, sourceId } = req.body;
        if (!paymentId) return res.status(400).json({ success: false, msg: 'Payment ID is required.' });

        const cleanPId = String(paymentId).trim();
        const idFilter = [{ paymentId: cleanPId }];
        if (mongoose.isValidObjectId(cleanPId)) idFilter.push({ _id: cleanPId });
        if (sourceReference) idFilter.push({ sourceReference: String(sourceReference).trim() });
        if (sourceId) idFilter.push({ sourceId: String(sourceId).trim() });
        const pSuffix = cleanPId.replace(/^PAY-(?:VND-|ORD-VND-|ORD-|AGT-|DEL-|TEC-)?/i, '').toLowerCase();
        if (pSuffix.length >= 4) idFilter.push({ paymentId: new RegExp(pSuffix + '$', 'i') });

        const payment = await Payment.findOne({ $or: idFilter });
        if (!payment) return res.status(404).json({ success: false, msg: 'Payment record not found.' });

        if (payment.status !== 'HOLD') {
            return res.status(400).json({ success: false, msg: `Payment is currently ${payment.status}, not on HOLD.` });
        }

        payment.status = 'PENDING';
        payment.holdReason = '';
        payment.previousHistory = payment.previousHistory || [];
        payment.previousHistory.push({
            action: 'RELEASE_HOLD',
            by: req.user.name || 'Administrator',
            date: new Date(),
            reason: reason ? reason.trim() : 'Released hold back to pending review',
            previousStatus: 'HOLD'
        });

        await payment.save();

        // Sync with source model (Settlement / Order) in database
        await syncPaymentSourceModel(payment, 'RELEASE_HOLD', { reason });

        await logPaymentAudit(req, 'payment_released_hold', payment.paymentId, `Payment ${payment.paymentId} released from HOLD to PENDING`);

        emitPaymentRealtime(req, 'released', payment.toObject());

        res.json({
            success: true,
            msg: `Payment ${payment.paymentId} released back to PENDING.`,
            payment: {
                _id: payment._id,
                paymentId: payment.paymentId,
                status: 'PENDING'
            }
        });
    } catch (err) {
        console.error('Error releasing hold:', err);
        res.status(500).json({ success: false, msg: 'Server error releasing hold.' });
    }
});

// =========================================================================
// 7. CANCEL PAYMENT (SECTION 12 & 13)
// =========================================================================
router.post('/cancel', auth, async (req, res) => {
    try {
        const { paymentId, cancellationReason, reason, recipientId, recipientType, recipientName, amount, payableAmount, paymentPurpose, sourceReference, sourceId, sourceModel } = req.body;
        const validReason = (cancellationReason || reason || '').trim();

        if (!paymentId) {
            return res.status(400).json({ success: false, msg: 'Payment ID is required.' });
        }
        if (!validReason) {
            return res.status(400).json({ success: false, msg: 'Cancellation reason is mandatory.' });
        }

        const cleanPId = String(paymentId).trim();
        const idFilter = [{ paymentId: cleanPId }];
        if (mongoose.isValidObjectId(cleanPId)) idFilter.push({ _id: cleanPId });
        if (sourceReference) idFilter.push({ sourceReference: String(sourceReference).trim() });
        if (sourceId) idFilter.push({ sourceId: String(sourceId).trim() });
        const pSuffix = cleanPId.replace(/^PAY-(?:VND-|ORD-VND-|ORD-|AGT-|DEL-|TEC-)?/i, '').toLowerCase();
        if (pSuffix.length >= 4) idFilter.push({ paymentId: new RegExp(pSuffix + '$', 'i') });

        let payment = await Payment.findOne({ $or: idFilter });

        if (!payment) {
            payment = new Payment({
                paymentId: cleanPId,
                paymentType: 'paid',
                paymentCategory: inferPaymentCategory(recipientType),
                recipientName: recipientName || 'Payable Recipient',
                recipientType: recipientType || 'Vendor',
                recipientId: recipientId || cleanPId,
                amount: amount || payableAmount || 0,
                paymentPurpose: paymentPurpose || 'Operational Disbursement',
                sourceReference: sourceReference || cleanPId,
                sourceId: sourceId ? String(sourceId) : undefined,
                sourceModel: sourceModel || (recipientType === 'Vendor' ? 'Settlement' : undefined),
                status: 'PENDING'
            });
        }

        if (payment.status === 'PAID') {
            return res.status(400).json({ success: false, msg: 'Cannot cancel a payment that has already been processed.' });
        }
        if (payment.status === 'CANCELLED') {
            return res.status(400).json({ success: false, msg: 'Payment is already in terminal CANCELLED state.' });
        }

        const previousStatus = payment.status;
        payment.status = 'CANCELLED';
        payment.cancellationReason = validReason;
        payment.cancelledBy = req.user.name || 'Administrator';
        payment.cancelledById = req.user.id || req.user._id;
        payment.cancelledAt = new Date();
        if (sourceId && !payment.sourceId) payment.sourceId = String(sourceId);
        if (sourceModel && !payment.sourceModel) payment.sourceModel = sourceModel;
        if (sourceReference && !payment.sourceReference) payment.sourceReference = sourceReference;

        payment.previousHistory = payment.previousHistory || [];
        payment.previousHistory.push({
            action: 'CANCEL',
            by: payment.cancelledBy,
            date: payment.cancelledAt,
            reason: validReason,
            previousStatus
        });

        await payment.save();

        // Sync with source model (Settlement / Order) in database
        await syncPaymentSourceModel(payment, 'CANCEL', { reason: validReason, actorName: payment.cancelledBy });

        await logPaymentAudit(req, 'payment_cancelled', payment.paymentId, `Payment ${payment.paymentId} cancelled: ${validReason}`, {
            reason: validReason,
            cancelledBy: payment.cancelledBy,
            previousStatus
        });

        emitPaymentRealtime(req, 'cancelled', payment.toObject());

        res.json({
            success: true,
            msg: `Payment ${payment.paymentId} has been cancelled successfully.`,
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
// 7B. DIRECT STATUS UPDATE (SUPER ADMIN CONTROLLER)
// =========================================================================
router.post('/update-status', auth, async (req, res) => {
    try {
        if (!isAuthorizedPaymentAdmin(req)) {
            return res.status(403).json({ success: false, msg: 'Access denied. Administrative authorization required.' });
        }
        const { paymentId, status, reason, recipientId, recipientType, recipientName, amount, payableAmount, paymentPurpose, sourceReference, sourceId, sourceModel } = req.body;
        if (!paymentId || !status) {
            return res.status(400).json({ success: false, msg: 'Payment ID and target status are required.' });
        }
        const targetStatus = String(status).trim().toUpperCase();
        if (!['PAID', 'HOLD', 'PENDING', 'CANCELLED'].includes(targetStatus)) {
            return res.status(400).json({ success: false, msg: 'Invalid target status. Must be PAID, HOLD, PENDING, or CANCELLED.' });
        }

        const cleanPId = String(paymentId).trim();
        const idFilter = [{ paymentId: cleanPId }];
        if (mongoose.isValidObjectId(cleanPId)) idFilter.push({ _id: cleanPId });
        if (sourceReference) idFilter.push({ sourceReference: String(sourceReference).trim() });
        if (sourceId) idFilter.push({ sourceId: String(sourceId).trim() });
        const pSuffix = cleanPId.replace(/^PAY-(?:VND-|ORD-VND-|ORD-|AGT-|DEL-|TEC-)?/i, '').toLowerCase();
        if (pSuffix.length >= 4) idFilter.push({ paymentId: new RegExp(pSuffix + '$', 'i') });

        let payment = await Payment.findOne({ $or: idFilter });
        if (!payment) {
            payment = new Payment({
                paymentId: cleanPId,
                paymentType: 'paid',
                paymentCategory: inferPaymentCategory(recipientType),
                recipientName: recipientName || 'Payable Recipient',
                recipientType: recipientType || 'Vendor',
                recipientId: recipientId || cleanPId,
                amount: amount || payableAmount || 0,
                paymentPurpose: paymentPurpose || 'Operational Disbursement',
                sourceReference: sourceReference || cleanPId,
                sourceId: sourceId ? String(sourceId) : undefined,
                sourceModel: sourceModel || (recipientType === 'Vendor' ? 'Settlement' : undefined),
                status: 'PENDING'
            });
        }

        const previousStatus = payment.status;
        payment.status = targetStatus;
        if (targetStatus === 'HOLD') {
            payment.holdReason = (reason || 'Placed on Hold by Admin').trim();
            payment.heldBy = req.user.name || 'Administrator';
            payment.heldAt = new Date();
        } else if (targetStatus === 'CANCELLED') {
            payment.cancellationReason = (reason || 'Cancelled by Admin').trim();
            payment.cancelledBy = req.user.name || 'Administrator';
            payment.cancelledAt = new Date();
        } else if (targetStatus === 'PAID') {
            payment.paymentDate = payment.paymentDate || new Date();
            payment.processedBy = req.user.name || 'Administrator';
            if (!payment.transactionReference) {
                payment.transactionReference = `TXN-FIC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            }
        } else if (targetStatus === 'PENDING') {
            payment.holdReason = '';
        }

        if (sourceId && !payment.sourceId) payment.sourceId = String(sourceId);
        if (sourceModel && !payment.sourceModel) payment.sourceModel = sourceModel;
        if (sourceReference && !payment.sourceReference) payment.sourceReference = sourceReference;

        payment.previousHistory = payment.previousHistory || [];
        payment.previousHistory.push({
            action: targetStatus,
            by: req.user.name || 'Administrator',
            date: new Date(),
            reason: (reason || '').trim(),
            previousStatus
        });

        await payment.save();
        await syncPaymentSourceModel(payment, targetStatus === 'PENDING' ? 'RELEASE_HOLD' : targetStatus, { reason, actorName: req.user.name });
        emitPaymentRealtime(req, 'updated', payment.toObject());

        res.json({
            success: true,
            msg: `Payment status updated to ${targetStatus} successfully.`,
            payment: {
                _id: payment._id,
                paymentId: payment.paymentId,
                status: payment.status,
                holdReason: payment.holdReason,
                cancellationReason: payment.cancellationReason,
                transactionReference: payment.transactionReference
            }
        });
    } catch (err) {
        console.error('Error updating payment status:', err);
        res.status(500).json({ success: false, msg: 'Server error updating payment status' });
    }
});

// =========================================================================
// 8. PAYMENT HISTORY & TRANSACTIONS (SECTION 15)
// =========================================================================
const handleHistoryQuery = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const filter = {};

        // Direction filter
        if (req.query.direction === 'DEBIT') {
            filter.paymentType = 'paid';
        } else if (req.query.direction === 'CREDIT') {
            filter.paymentType = 'received';
        }

        // Status filter
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status.toUpperCase();
        }

        // Recipient / Category filter
        if (req.query.recipientType && req.query.recipientType !== 'all') {
            filter.recipientType = req.query.recipientType;
        }
        if (req.query.category && req.query.category !== 'all') {
            filter.paymentCategory = req.query.category;
        }

        // Date Range
        if (req.query.startDate || req.query.endDate) {
            filter.createdAt = {};
            if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) {
                const end = new Date(req.query.endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        // Search filter
        if (req.query.search) {
            const s = req.query.search.trim();
            filter.$or = [
                { paymentId: new RegExp(s, 'i') },
                { recipientName: new RegExp(s, 'i') },
                { recipientEmail: new RegExp(s, 'i') },
                { recipientPhone: new RegExp(s, 'i') },
                { transactionReference: new RegExp(s, 'i') },
                { sourceReference: new RegExp(s, 'i') },
                { notes: new RegExp(s, 'i') },
                { paymentPurpose: new RegExp(s, 'i') }
            ];
        }

        const [records, total] = await Promise.all([
            Payment.find(filter)
                .sort({ updatedAt: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Payment.countDocuments(filter)
        ]);

        const historyItems = records.map((p, idx) => ({
            _id: p._id,
            serialNumber: skip + idx + 1,
            paymentId: p.paymentId || String(p._id),
            transactionReference: p.transactionReference || p.paymentId || '—',
            recipientName: p.recipientName || 'External Recipient',
            recipientType: p.recipientType || (p.paymentType === 'paid' ? 'Vendor' : 'Customer'),
            recipientId: p.recipientId ? String(p.recipientId) : (p.sourceReference || '—'),
            recipientEmail: p.recipientEmail || '',
            recipientPhone: p.recipientPhone || '',
            paymentPurpose: p.paymentPurpose || p.notes || (p.paymentType === 'paid' ? 'Payout / Commission Disbursement' : 'Customer Payment Inflow'),
            sourceReference: p.sourceReference || p.sourceId || '—',
            amount: Number(p.amount || 0),
            paymentMethod: p.paymentMethod || p.paymentMode || 'Bank Transfer',
            paymentMode: p.paymentMethod || p.paymentMode || 'Bank Transfer',
            status: (p.status || 'PAID').toUpperCase(),
            paidDate: p.paymentDate || p.updatedAt || p.createdAt,
            paymentDate: p.paymentDate || p.updatedAt || p.createdAt,
            processedDate: p.paymentDate || p.updatedAt || p.createdAt,
            createdAt: p.createdAt,
            processedBy: p.processedBy || p.createdBy || 'System',
            direction: p.direction || (p.paymentType === 'paid' ? 'DEBIT' : 'CREDIT'),
            paymentCategory: p.paymentCategory || (p.paymentType === 'paid' ? 'vendor_payout' : 'customer_payment'),
            bankAccountNumber: p.bankAccountNumber || '',
            maskedAccountNumber: p.bankAccountNumber ? '•••• ' + String(p.bankAccountNumber).slice(-4) : '',
            bankIfsc: p.bankIfsc || '',
            bankName: p.bankName || '',
            holdReason: p.holdReason || '',
            cancellationReason: p.cancellationReason || '',
            failureReason: p.failureReason || '',
            reason: p.status === 'CANCELLED' ? (p.cancellationReason || 'Admin Cancelled') : (p.status === 'HOLD' ? (p.holdReason || 'Placed on Hold') : (p.failureReason || ''))
        }));

        res.json({
            success: true,
            total,
            totalCount: total,
            page,
            totalPages: Math.ceil(total / limit) || 1,
            history: historyItems,
            transactions: historyItems
        });

    } catch (err) {
        console.error('Error retrieving payment history:', err);
        res.status(500).json({ success: false, msg: 'Server error retrieving payment history' });
    }
};

router.get('/history', auth, handleHistoryQuery);
router.get('/transactions', auth, handleHistoryQuery);

// =========================================================================
// 9. AUDIT LOGS & RECEIPTS
// =========================================================================
router.get('/audit-log', auth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.search) {
            const s = req.query.search.trim();
            filter.$or = [
                { paymentId: new RegExp(s, 'i') },
                { action: new RegExp(s, 'i') },
                { user: new RegExp(s, 'i') },
                { details: new RegExp(s, 'i') }
            ];
        }

        const [logs, total] = await Promise.all([
            PaymentAuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
            PaymentAuditLog.countDocuments(filter)
        ]);

        res.json({
            success: true,
            total,
            page,
            totalPages: Math.ceil(total / limit) || 1,
            logs
        });
    } catch (err) {
        res.status(500).json({ success: false, msg: 'Error retrieving audit logs' });
    }
});

router.get('/receipt/:id', auth, async (req, res) => {
    try {
        const cleanId = String(req.params.id || '').trim();
        const idFilter = [{ paymentId: cleanId }];
        if (mongoose.isValidObjectId(cleanId)) idFilter.push({ _id: cleanId });

        let payment = await Payment.findOne({ $or: idFilter }).lean();

        // Fallback: check settlements collection if not yet in Payment collection
        if (!payment) {
            const db = mongoose.connection.db;
            const sIdSuffix = cleanId.replace(/^PAY-(?:VND-)?/i, '').toLowerCase();
            const settlOr = [{ _id: cleanId }, { paymentId: cleanId }];
            if (sIdSuffix && sIdSuffix.length >= 4) {
                settlOr.push({ _id: new RegExp(sIdSuffix + '$', 'i') });
            }
            const settlDoc = await db.collection('settlements').findOne({ $or: settlOr });
            if (settlDoc) {
                const sIdStr = String(settlDoc._id);
                payment = {
                    paymentId: settlDoc.paymentId || `PAY-VND-${sIdStr.slice(-6).toUpperCase()}`,
                    transactionReference: settlDoc.transactionReference || `TXN-SETTL-${sIdStr.slice(-6).toUpperCase()}`,
                    amount: settlDoc.netAmount || settlDoc.grossAmount,
                    currency: 'INR',
                    recipientName: settlDoc.vendorBusinessName || 'Vendor Merchant',
                    recipientType: 'Vendor',
                    paymentPurpose: `Store settlement for ${settlDoc.vendorBusinessName || 'Merchant Outlet'}`,
                    paymentDate: settlDoc.paidAt || settlDoc.settlementDate || settlDoc.updatedAt || new Date(),
                    paymentMethod: 'Bank Transfer',
                    bankName: 'Direct Account',
                    bankAccountNumber: '•••• 8821',
                    status: (settlDoc.status === 'Completed' || settlDoc.paymentStatus === 'PAID') ? 'PAID' : (settlDoc.paymentStatus || 'PENDING'),
                    processedBy: settlDoc.processedBy || 'Super Admin'
                };
            }
        }

        if (!payment) return res.status(404).json({ success: false, msg: 'Payment not found' });

        res.json({
            success: true,
            receipt: {
                receiptNumber: payment.receiptNumber || `RCP-${payment.paymentId ? payment.paymentId.replace(/[^A-Za-z0-9]/g, '').slice(-8) : '000000'}`,
                paymentId: payment.paymentId,
                transactionReference: payment.transactionReference || 'PENDING',
                amount: payment.amount,
                currency: payment.currency || 'INR',
                recipientName: payment.recipientName,
                recipientType: payment.recipientType,
                paymentPurpose: payment.paymentPurpose || payment.notes,
                paymentDate: payment.paymentDate || payment.updatedAt,
                paymentMethod: payment.paymentMethod || 'Bank Transfer',
                bankName: payment.bankName || 'Direct Account',
                accountNumber: maskAccountNumber(payment.bankAccountNumber),
                status: payment.status,
                processedBy: payment.processedBy || 'Super Admin'
            }
        });
    } catch (err) {
        console.error('Error generating receipt:', err);
        res.status(500).json({ success: false, msg: 'Error generating receipt' });
    }
});

module.exports = router;
