const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { validateTerritoryHierarchy } = require('./territory');
const Pincode = require('../models/Pincode');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const SecuritySession = require('../models/SecuritySession');
const SecurityLog = require('../models/SecurityLog');
const { parseDeviceInfo } = require('../middleware/security');
const { validateIndianMobile } = require('../utils/inputValidator');

// Password Strength & Policy Validator
const validatePasswordPolicy = (password) => {
    if (!password) return { isValid: false, msg: 'Password is required' };
    if (password.length < 8 || password.length > 32) {
        return { isValid: false, msg: 'Password length must be between 8 and 32 characters' };
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        return { isValid: false, msg: 'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character' };
    }
    return { isValid: true };
};

const cacheService = require('../utils/cacheService');

// Redis-backed OTP Store with TTL & multi-instance synchronization
const saveLoginOtp = async (identifier, otpCode) => {
    const data = { otp: otpCode, attempts: 0, createdAt: Date.now() };
    await cacheService.set(`otp:login:${identifier}`, JSON.stringify(data), 300); // 5 mins
};

const getLoginOtp = async (identifier) => {
    const raw = await cacheService.get(`otp:login:${identifier}`);
    if (!raw) return null;
    try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
        return null;
    }
};

const incrementLoginOtpAttempts = async (identifier, currentData) => {
    currentData.attempts = (currentData.attempts || 0) + 1;
    await cacheService.set(`otp:login:${identifier}`, JSON.stringify(currentData), 300);
};

const deleteLoginOtp = async (identifier) => {
    await cacheService.del(`otp:login:${identifier}`);
};

// Helper to create and track Security Session
const createSecuritySession = async (userId, token, req) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || '';
        const deviceInfo = parseDeviceInfo(userAgent);

        const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await SecuritySession.create({
            userId,
            tokenHash,
            deviceInfo,
            ipAddress: clientIp,
            isActive: true,
            lastActive: new Date(),
            expiresAt
        });
    } catch (e) {
        console.error('Create security session error:', e);
    }
};

// @route    POST api/auth/register & api/auth/register-vendor
// @desc     Register user (Agent, Vendor, etc.)
// @access   Public
const handleRegister = async (req, res) => {
    const { name, email, password, role, level } = req.body;
    try {
        const lowerEmail = (email || '').toLowerCase().trim();
        let user = await User.findOne({ email: lowerEmail });
        if (user) return res.status(400).json({ message: 'Email already registered', msg: 'User already exists' });

        if (req.body.phone) {
            // Strict Indian Mobile Number Validation (^[6-9][0-9]{9}$)
            const phoneCheck = validateIndianMobile(req.body.phone);
            if (!phoneCheck.isValid) {
                return res.status(400).json({ message: phoneCheck.message, msg: phoneCheck.message });
            }
            let existingPhone = await User.findOne({ phone: phoneCheck.cleanPhone });
            if (existingPhone) return res.status(400).json({ message: 'Phone number already registered', msg: 'Phone number already registered' });
        }

        // Validate Password Policy
        const pwdPolicy = validatePasswordPolicy(password);
        if (!pwdPolicy.isValid) {
            return res.status(400).json({ message: pwdPolicy.msg, msg: pwdPolicy.msg });
        }

        // Generate unique Registration ID: REG-YYYYMMDD-XXXX
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randDigits = Math.floor(1000 + Math.random() * 9000);
        const registrationId = req.body.registrationId || `REG-${dateStr}-${randDigits}`;

        // Extract territory string
        const territory = req.body.territory || {};
        let rawRole = (level || req.body.level || role || req.body.role || 'pincode').toString().toLowerCase().trim();
        if (rawRole === 'agent' || rawRole === 'approved') rawRole = (level || req.body.level || 'pincode').toString().toLowerCase().trim();
        let agentRole = 'pincode';
        if (rawRole.includes('state')) agentRole = 'state';
        else if (rawRole.includes('district') || rawRole.includes('dist')) agentRole = 'district';
        else if (rawRole.includes('divis') || rawRole.includes('division')) agentRole = 'division';
        else if (rawRole.includes('pincode') || rawRole.includes('pin')) agentRole = 'pincode';
        let territoryParts = [];
        if (territory.state || territory.district || territory.division || territory.pincode) {
            const stateVal = territory.state || '';
            const distVal = territory.district || '';
            const divVal = territory.division || '';
            const pinVal = territory.pincode || '';
            if (agentRole === 'state') territoryParts = [stateVal].filter(Boolean);
            else if (agentRole === 'district') territoryParts = [stateVal, distVal].filter(Boolean);
            else if (agentRole === 'division') territoryParts = [stateVal, distVal, divVal].filter(Boolean);
            else territoryParts = [stateVal, distVal, divVal, pinVal].filter(Boolean);
        }
        let territoryStr = territoryParts.length > 0 ? territoryParts.join(' / ') : (req.body.assignedArea || territory.state || '');

        // Central Database Hierarchy Validation (Mandatory Rule)
        const cleanTerritory = {
            state: territory.state || req.body.state || req.body.assignedState || '',
            district: territory.district || req.body.district || req.body.assignedDistrict || '',
            division: territory.division || req.body.division || req.body.assignedDivision || '',
            pincode: territory.pincode || req.body.pincode || req.body.assignedPincode || ''
        };

        let pincodeId = null;

        if (cleanTerritory.state || cleanTerritory.district || cleanTerritory.division || cleanTerritory.pincode) {
            const terrVal = await validateTerritoryHierarchy({
                state: cleanTerritory.state,
                district: ['district', 'division', 'pincode'].includes(agentRole) ? cleanTerritory.district : null,
                division: ['division', 'pincode'].includes(agentRole) ? cleanTerritory.division : null,
                pincode: agentRole === 'pincode' ? cleanTerritory.pincode : null,
                requireActive: true
            });

            if (!terrVal.valid) {
                return res.status(400).json({ msg: terrVal.message, message: terrVal.message, error: 'INVALID_TERRITORY' });
            }

            if (terrVal.data?.state) cleanTerritory.state = terrVal.data.state.name;
            if (terrVal.data?.district) cleanTerritory.district = terrVal.data.district.name;
            if (terrVal.data?.division) cleanTerritory.division = terrVal.data.division.name;
            if (terrVal.data?.pincode) {
                cleanTerritory.pincode = terrVal.data.pincode.code;
                pincodeId = terrVal.data.pincode._id;
            }
        }

        const kDocs = req.body.kycDocs || {};
        const kycMapped = req.body.kyc || {};

        const isVendorRole = rawRole === 'vendor' || rawRole === 'merchant';
        if (isVendorRole) {
            const Vendor = require('../models/Vendor');
            user = new User({
                name: name || req.body.contactPerson || req.body.businessName || 'Vendor Merchant',
                businessName: req.body.businessName || name || 'Vendor Business',
                contactPerson: req.body.contactPerson || name || 'Contact Person',
                email: lowerEmail,
                phone: req.body.phone,
                altPhone: req.body.altPhone || req.body.alternativePhone || req.body.secondaryPhone || '',
                password,
                role: 'Vendor',
                vendorType: req.body.category || req.body.vendorType || 'General Store',
                category: req.body.category || req.body.vendorType || 'General Store',
                subCategory: req.body.subCategory || req.body.subcategory || '',
                joiningType: 'direct',
                createdVia: 'vendor_website',
                registrationSource: 'vendor_website',
                requestType: 'onboarding',
                requestOrigin: 'vendor_website',
                isDirectRequest: true,
                assignedArea: territoryStr,
                assignedState: cleanTerritory.state,
                assignedDistrict: cleanTerritory.district,
                assignedDivision: cleanTerritory.division,
                state: cleanTerritory.state,
                district: cleanTerritory.district,
                division: cleanTerritory.division,
                pincode: cleanTerritory.pincode,
                address: req.body.address || req.body.fullAddress || territoryStr,
                fullAddress: req.body.fullAddress || req.body.address || territoryStr,
                registrationId,
                status: 'pending',
                kycStatus: 'Pending KYC',
                isActive: false,
                kycDocs: kDocs,
                kyc: kycMapped,
                createdAt: new Date()
            });

            const salt = await bcrypt.genSalt(12);
            user.password = await bcrypt.hash(password, salt);
            await user.save();

            try {
                const newVendorDoc = new Vendor({
                    ...user.toObject(),
                    _id: user._id
                });
                await newVendorDoc.save().catch(() => {});
            } catch (vErr) {}

            try {
                const io = req.app.get('io');
                if (io) {
                    const payload = {
                        _id: user._id,
                        id: user._id,
                        name: user.name,
                        businessName: user.businessName,
                        email: user.email,
                        phone: user.phone,
                        role: 'Vendor',
                        status: 'pending',
                        registrationId: user.registrationId,
                        joiningType: 'direct',
                        isDirectRequest: true,
                        createdAt: new Date()
                    };
                    io.to('admin').emit('vendor_registered_direct', payload);
                    io.to('admin').emit('new_registration_request', payload);
                    io.emit('vendor_registered_direct', payload);
                    io.emit('new_registration_request', payload);
                }
            } catch (ioErr) {}

            return res.status(201).json({
                message: 'Vendor registered successfully. Pending Admin approval.',
                registrationId,
                role: 'Vendor',
                status: 'pending',
                vendor: {
                    id: user._id,
                    businessName: user.businessName,
                    name: user.name,
                    email: user.email,
                    role: 'Vendor',
                    status: 'pending',
                    registrationId
                }
            });
        }

        user = new User({ 
            name, 
            email: lowerEmail, 
            phone: req.body.phone,
            altPhone: req.body.altPhone || req.body.alternativePhone || req.body.secondaryPhone || '',
            dob: req.body.dob || req.body.dateOfBirth || '',
            gender: req.body.gender || '',
            qualification: req.body.qualification || req.body.highestQualification || '',
            experience: req.body.experience || req.body.experienceLevel || '',
            previousCompany: req.body.previousCompany || req.body.previousOrg || '',
            password, 
            role: 'agent', 
            level: agentRole,
            territory: cleanTerritory,
            assignedArea: territoryStr,
            assignedState: cleanTerritory.state,
            assignedDistrict: cleanTerritory.district,
            assignedDivision: cleanTerritory.division,
            state: cleanTerritory.state,
            district: cleanTerritory.district,
            division: cleanTerritory.division,
            pincode: cleanTerritory.pincode,
            postOffice: req.body.postOffice || req.body.postOfficeBranch || '',
            address: req.body.address || req.body.fullAddress || territoryStr,
            fullAddress: req.body.fullAddress || req.body.address || territoryStr,
            registrationId,
            status: 'pending',
            isActive: false,
            kycDocs: kDocs,
            kyc: kycMapped,
            assignedPincode: pincodeId || null,
            createdAt: new Date()
        });

        // Salt rounds 12 for enterprise security
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        // Sync document to raw 'agents' collection in MongoDB
        try {
            const db = mongoose.connection.db;
            if (db) {
                await db.collection('agents').updateOne(
                    { registrationId: user.registrationId },
                    {
                        $set: {
                            registrationId: user.registrationId,
                            name: user.name,
                            email: user.email,
                            phone: user.phone,
                            altPhone: user.altPhone || '',
                            role: agentRole,
                            level: agentRole,
                            status: 'pending',
                            kycStatus: 'pending',
                            isActive: false,
                            isApproved: false,
                            territory: cleanTerritory,
                            assignedArea: territoryStr,
                            kyc: kycMapped,
                            kycDocs: kDocs,
                            createdAt: new Date()
                        }
                    },
                    { upsert: true }
                );
            }
        } catch (sErr) {
            console.error('Error syncing raw agent document on registration:', sErr);
        }

        // Audit Log
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        await AuditLog.create({
            userId: user._id,
            userEmail: user.email,
            userRole: agentRole,
            action: 'device_login',
            ipAddress: clientIp,
            userAgent: req.headers['user-agent'] || '',
            status: 'success',
            details: 'New Agent registered and pending approval'
        }).catch(() => {});

        // Real-time Socket.IO emission to Admin room and broadcast
        try {
            const io = req.app.get('io');
            if (io) {
                const payload = {
                    id: user._id,
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: agentRole,
                    level: agentRole,
                    status: 'pending',
                    kycStatus: 'pending',
                    registrationId: user.registrationId,
                    createdAt: new Date()
                };
                io.to('admin').emit('agent_registered', payload);
                io.to('admin').emit('agent_onboarded_request', payload);
                io.to('admin').emit('new_registration_request', payload);
                io.emit('agent_registered', payload);
                io.emit('agent_onboarded_request', payload);
                io.emit('new_registration_request', payload);
            }
        } catch (ioErr) {
            console.warn('Socket.IO emit warning on agent register:', ioErr.message);
        }

        return res.status(201).json({ 
            message: 'Agent registered successfully. Pending Admin approval.',
            registrationId,
            role: agentRole,
            status: 'pending',
            agent: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: agentRole,
                status: 'pending',
                registrationId
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

router.post('/register', handleRegister);
router.post('/register-vendor', (req, res, next) => {
    req.body.role = req.body.role || 'Vendor';
    next();
}, handleRegister);

// @route    POST api/auth/register-customer
// @desc     Register customer user directly
// @access   Public
router.post('/register-customer', async (req, res) => {
    try {
        const body = req.body || {};
        const { name, email, phone, password, aadhaarNumber, panNumber, address, city, pincode } = body;
        const cleanName = (name || '').trim();
        const lowerEmail = (email || '').toLowerCase().trim();
        const cleanPhone = (phone || '').replace(/\D/g, '');
        const cleanAddress = (address || '').trim();
        const cleanCity = (city || '').trim();
        const cleanPincode = (pincode || '').trim();

        if (!lowerEmail && !cleanPhone) {
            return res.status(400).json({ status: 'error', message: 'Email or mobile number is required', msg: 'Email or mobile number is required' });
        }

        // Check if user with same email or phone already exists
        let existingUser = await User.findOne({
            $or: [
                ...(lowerEmail ? [{ email: lowerEmail }] : []),
                ...(cleanPhone ? [
                    { phone: cleanPhone },
                    { phone: `+91${cleanPhone}` },
                    { phone: `91${cleanPhone}` }
                ] : [])
            ]
        });

        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'A user with this mobile number or email is already registered. Please login.',
                msg: 'A user with this mobile number or email is already registered. Please login.'
            });
        }

        // Hash password if provided, or default
        const pwd = password || 'ConnectCustomer123!';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(pwd, salt);

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randDigits = Math.floor(1000 + Math.random() * 9000);
        const registrationId = `CUST-${dateStr}-${randDigits}`;

        const newUser = new User({
            name: cleanName || 'Customer Member',
            email: lowerEmail || `${cleanPhone}@connect.app`,
            phone: cleanPhone || '',
            password: hashedPassword,
            role: 'customer',
            status: 'active',
            isActive: true,
            address: cleanAddress,
            city: cleanCity,
            pincode: cleanPincode,
            registrationId,
            kyc: {
                aadhaarNumber: aadhaarNumber || '',
                panNumber: panNumber || ''
            },
            createdAt: new Date()
        });

        await newUser.save();

        const secret = process.env.JWT_SECRET;
        if (!secret) return res.status(500).json({ msg: 'Server configuration error' });
        const payload = { user: { id: newUser.id, role: 'customer' } };
        const token = jwt.sign(payload, secret, { expiresIn: '30d' });

        return res.status(201).json({
            status: 'success',
            success: true,
            message: 'Customer registered successfully',
            msg: 'Customer registered successfully',
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                role: 'customer',
                address: newUser.address,
                city: newUser.city,
                pincode: newUser.pincode,
                registrationId
            }
        });
    } catch (err) {
        console.error('Customer registration error:', err);
        return res.status(500).json({ status: 'error', message: 'Registration failed due to server error', error: err.message });
    }
});

// @route    POST api/auth/login
// @desc     Authenticate user & get token with progressive security
// @access   Public
router.post('/login', async (req, res) => {
    const body = req.body || {};
    const email = body.email || body.username || body.phone || '';
    const password = body.password || '';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    const lowerEmail = (email || '').toLowerCase().trim();
    if (!lowerEmail || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Email or Mobile and password are required',
            msg: 'Email or Mobile and password are required'
        });
    }

    try {
        const cleanDigits = lowerEmail.replace(/\D/g, '');
        let user = await User.findOne({
            $or: [
                { email: lowerEmail },
                { phone: lowerEmail },
                ...(cleanDigits ? [
                    { phone: cleanDigits },
                    { phone: `+91${cleanDigits}` },
                    { phone: `91${cleanDigits}` }
                ] : [])
            ]
        });

        if (!user) {
            await AuditLog.create({
                userEmail: lowerEmail,
                action: 'login_failed',
                ipAddress: clientIp,
                userAgent,
                status: 'failed',
                details: 'Login attempt failed - Account not found'
            }).catch(() => {});
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email or password',
                msg: 'Invalid email or password'
            });
        }

        // 1. Check Hard Lockout (10+ failed attempts)
        if (user.isLocked) {
            await AuditLog.create({
                userId: user._id,
                userEmail: user.email,
                userRole: user.role,
                action: 'account_locked',
                ipAddress: clientIp,
                userAgent,
                status: 'blocked',
                details: 'Locked account login attempt rejected'
            }).catch(() => {});

            return res.status(403).json({
                error: 'Account Locked',
                message: 'Your account is permanently locked due to 10+ failed login attempts. Admin approval is required to unlock.',
                isLocked: true
            });
        }

        // 2. Check Temporary Lockout (5+ failed attempts = 15m lock)
        if (user.lockUntil && user.lockUntil > new Date()) {
            const remainingMins = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / (60 * 1000));
            return res.status(403).json({
                error: 'Temporary Lock',
                message: `Account temporarily locked due to multiple failed login attempts. Please try again in ${remainingMins} minutes.`,
                retryAfterMinutes: remainingMins
            });
        }

        // 3. Match Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

            if (user.failedLoginAttempts >= 10) {
                user.isLocked = true;
                user.lockUntil = null;
            } else if (user.failedLoginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
            } else if (user.failedLoginAttempts >= 3) {
                user.requireCaptcha = true;
            }
            await user.save();

            await AuditLog.create({
                userId: user._id,
                userEmail: user.email,
                userRole: user.role,
                action: 'login_failed',
                ipAddress: clientIp,
                userAgent,
                status: 'failed',
                details: `Failed password attempt ${user.failedLoginAttempts}/10`
            }).catch(() => {});

            let warningMsg = 'Invalid email or password';
            if (user.failedLoginAttempts >= 10) {
                warningMsg = 'Account has been locked due to 10 failed login attempts. Contact Admin.';
            } else if (user.failedLoginAttempts >= 5) {
                warningMsg = 'Account locked for 15 minutes due to 5 failed attempts.';
            } else if (user.failedLoginAttempts >= 3) {
                warningMsg = 'Warning: 3 failed attempts. CAPTCHA verification required.';
            }

            return res.status(401).json({
                message: warningMsg,
                msg: warningMsg,
                failedAttempts: user.failedLoginAttempts,
                requireCaptcha: user.requireCaptcha
            });
        }

        // For agents: enforce suspension and status check
        if (user.role === 'agent' || user.role === 'Agent' || (user.registrationId && user.registrationId.startsWith('AG-'))) {
            try {
                const db = mongoose.connection.db;
                if (db) {
                    const rawAgent = await db.collection('agents').findOne({
                        $or: [
                            { email: user.email.toLowerCase() },
                            { phone: user.phone },
                            { registrationId: user.registrationId }
                        ]
                    });
                    if (rawAgent) {
                        const rawStatus = (rawAgent.status || rawAgent.kycStatus || '').toLowerCase();
                        if (rawStatus === 'approved' || rawAgent.isApproved) {
                            if (user.status !== 'approved' || user.kycStatus !== 'approved' || !user.isActive || !user.isApproved) {
                                user.status = 'approved';
                                user.kycStatus = 'approved';
                                user.isActive = true;
                                user.isApproved = true;
                                await user.save();
                            }
                        }
                    }
                }
            } catch (aSyncErr) {
                console.error("Error syncing agent status during login:", aSyncErr);
            }

            const userStatus = (user.status || 'pending').toLowerCase();
            if (userStatus === 'revoked') {
                return res.status(403).json({
                    title: 'Access Revoked',
                    message: 'Your agent access has been revoked. Please contact the administrator.',
                    msg: 'Your agent access has been revoked. Please contact the administrator.',
                    error: 'Access Revoked',
                    status: 'revoked',
                    isRevoked: true,
                    registrationId: user.registrationId || 'N/A',
                    role: user.level || 'pincode'
                });
            }
            if (userStatus === 'suspended' || (!user.isActive && userStatus !== 'approved' && userStatus !== 'active')) {
                return res.status(403).json({
                    title: 'Account Suspended',
                    message: 'Your account has been suspended. Please contact the administrator.',
                    msg: 'Your account has been suspended. Please contact the administrator.',
                    error: 'Account Suspended',
                    status: 'suspended',
                    isSuspended: true,
                    registrationId: user.registrationId || 'N/A',
                    role: user.level || 'pincode'
                });
            }
            if (userStatus === 'pending' || userStatus === 'pending_approval' || userStatus === 'under_verification') {
                return res.status(403).json({
                    title: 'YOUR REQUEST IS UNDER REVIEW',
                    heading: 'YOUR REQUEST IS UNDER REVIEW',
                    message: 'Your agent registration request has been successfully submitted.\n\nYour request is currently under review by the administration.\n\nPlease contact the administration for further assistance.',
                    status: 'pending',
                    approvalStatus: 'PENDING',
                    registrationId: user.registrationId || 'N/A',
                    role: user.level || 'pincode'
                });
            }
            if (userStatus === 'rejected') {
                const reasonText = user.rejectionReason ? ` Reason: ${user.rejectionReason}` : '';
                return res.status(403).json({
                    title: 'APPLICATION REJECTED',
                    heading: 'APPLICATION REJECTED',
                    message: `Your agent registration request has been rejected by the administration.${reasonText}\n\nPlease contact support for further assistance.`,
                    rejectionReason: user.rejectionReason || '',
                    status: 'rejected',
                    approvalStatus: 'REJECTED',
                    registrationId: user.registrationId || 'N/A',
                    role: user.level || 'pincode'
                });
            }
        }

        // For vendors: enforce status check
        if (['vendor', 'Vendor', 'merchant', 'Merchant'].includes(user.role)) {
            const userStatus = (user.status || '').toLowerCase().trim();
            if (userStatus === 'inactive') {
                return res.status(403).json({
                    message: 'Your account has been deactivated. Please contact the administrator.',
                    msg: 'Your account has been deactivated. Please contact the administrator.',
                    status: 'inactive'
                });
            }
            if (userStatus === 'suspended') {
                return res.status(403).json({
                    message: 'Your account has been suspended. Please contact the administrator.',
                    msg: 'Your account has been suspended. Please contact the administrator.',
                    status: 'suspended'
                });
            }
            if (userStatus === 'pending' || userStatus === 'pending_approval' || userStatus === 'pending approval' || userStatus === 'under_verification' || userStatus === 'under verification' || userStatus === 'in_review' || userStatus === 'unapproved' || (!user.isActive && userStatus !== 'approved' && userStatus !== 'active')) {
                return res.status(403).json({
                    message: 'Your profile is currently under verification. Please contact the Administration for further assistance.',
                    msg: 'Your profile is currently under verification. Please contact the Administration for further assistance.',
                    error: 'Profile Under Verification',
                    status: 'under_verification',
                    isUnderVerification: true
                });
            }
            if (userStatus === 'rejected') {
                return res.status(403).json({
                    message: 'Your vendor account registration was rejected.',
                    msg: 'Your vendor account registration was rejected.',
                    status: 'rejected'
                });
            }
        }

        // Successful Login -> Reset Failure Counter
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
        user.requireCaptcha = false;
        await user.save();

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('FATAL: JWT_SECRET environment variable is missing.');
            return res.status(500).json({ msg: 'Server configuration error' });
        }
        const payload = { user: { id: user.id, role: user.role, adminRole: user.adminRole } };
        const token = jwt.sign(payload, secret, { expiresIn: '7d' });

        // Record Multi-Device Session & Audit Log
        await createSecuritySession(user._id, token, req);
        await AuditLog.create({
            userId: user._id,
            userEmail: user.email,
            userRole: user.role,
            action: 'login_success',
            ipAddress: clientIp,
            userAgent,
            status: 'success',
            details: 'Successful user authentication'
        }).catch(() => {});

        const userObj = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            adminRole: user.adminRole,
            branchId: user.branchId,
            status: user.status,
            isActive: user.isActive
        };

        const agentObj = {
            _id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            role: user.level || user.role || 'pincode',
            level: user.level || 'pincode',
            registrationId: user.registrationId || '',
            kycStatus: user.status === 'approved' ? 'approved' : user.status || 'pending',
            territory: { state: user.assignedArea || '' },
            kyc: user.kyc || {},
            registrationFeePaid: user.isActive || false,
            performanceScore: 0,
            status: user.status,
            isActive: user.isActive,
            createdAt: user.createdAt || new Date().toISOString()
        };

        res.json({ token, user: userObj, agent: agentObj });

    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).send('Server error');
    }
});

// @route    POST api/auth/send-otp
// @desc     Send 6-digit OTP (5m expiry, 30s resend)
// @access   Public
router.post('/send-otp', async (req, res) => {
    try {
        const identifier = (req.body.phone || req.body.mobileNumber || req.body.mobileOrEmail || req.body.email || '').toString().toLowerCase().trim();
        if (!identifier) return res.status(400).json({ status: 'error', message: 'Mobile number or Email is required', msg: 'Mobile number or Email is required' });

        const cleanDigits = identifier.replace(/\D/g, '');

        // Verify if user is registered in MongoDB database
        let user = await User.findOne({
            $or: [
                { email: identifier },
                { phone: identifier },
                ...(cleanDigits ? [
                    { phone: cleanDigits },
                    { phone: `+91${cleanDigits}` },
                    { phone: `91${cleanDigits}` },
                    { phone: new RegExp(cleanDigits + '$') }
                ] : [])
            ]
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                notRegistered: true,
                message: 'This mobile number is not registered. Please register to continue.',
                msg: 'This mobile number is not registered. Please register to continue.'
            });
        }

        const existingOtp = await getLoginOtp(identifier);
        if (existingOtp && (Date.now() - existingOtp.createdAt) < 30000) {
            return res.status(429).json({ status: 'error', message: 'Please wait 30 seconds before requesting another OTP.' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
        await saveLoginOtp(identifier, otpCode);

        await AuditLog.create({
            userEmail: identifier,
            action: 'otp_sent',
            ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
            status: 'success',
            details: `OTP dispatched to registered contact for ${identifier}`
        }).catch(() => {});

        res.json({
            success: true,
            status: 'success',
            message: 'OTP sent successfully. Valid for 5 minutes.'
        });
    } catch (err) {
        console.error('Send OTP error:', err);
        res.status(500).send('Server error');
    }
});

// @route    POST api/auth/verify-otp
// @desc     Verify 6-digit OTP (max 3 attempts)
// @access   Public
router.post('/verify-otp', async (req, res) => {
    try {
        const identifier = (req.body.phone || req.body.mobileNumber || req.body.mobileOrEmail || req.body.email || '').toString().toLowerCase().trim();
        const otp = (req.body.otp || '').toString().trim();

        if (!identifier || !otp) return res.status(400).json({ status: 'error', message: 'Mobile/Email and OTP are required' });

        const cleanDigits = identifier.replace(/\D/g, '');
        const stored = await getLoginOtp(identifier) || (cleanDigits ? await getLoginOtp(cleanDigits) : null);

        if (!stored) {
            return res.status(400).json({ msg: 'No active OTP request found or OTP has expired. Please request a new OTP.' });
        }

        if (stored.attempts >= 3) {
            await deleteLoginOtp(identifier);
            if (cleanDigits) await deleteLoginOtp(cleanDigits);
            return res.status(400).json({ msg: 'Maximum OTP verification attempts exceeded. Please request a new OTP.' });
        }

        if (stored.otp !== otp) {
            await incrementLoginOtpAttempts(identifier, stored);
            if (cleanDigits) await incrementLoginOtpAttempts(cleanDigits, stored);
            return res.status(400).json({ msg: `Invalid OTP. Attempts left: ${Math.max(0, 2 - (stored.attempts || 0))}` });
        }

        // OTP verified successfully - invalidate immediately (one-time use)
        await deleteLoginOtp(identifier);
        if (cleanDigits) await deleteLoginOtp(cleanDigits);

        const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
        if (!user) return res.status(404).json({ msg: 'User profile not found' });

        const secret = process.env.JWT_SECRET;
        if (!secret) return res.status(500).json({ msg: 'Server configuration error' });

        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, secret, { expiresIn: '7d' });

        await createSecuritySession(user._id, token, req);
        await AuditLog.create({
            userId: user._id,
            userEmail: user.email,
            userRole: user.role,
            action: 'otp_verify',
            ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
            status: 'success',
            details: 'OTP verified successfully'
        }).catch(() => {});

        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } });
    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).send('Server error');
    }
});

// @route    GET api/auth/sessions
// @desc     List user's active device logins
// @access   Private
router.get('/sessions', async (req, res) => {
    try {
        let token = req.header('x-auth-token');
        const authHeader = req.header('Authorization');
        if (!token && authHeader && authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

        const secret = process.env.JWT_SECRET;
        if (!secret) return res.status(500).json({ msg: 'Server configuration error' });
        const decoded = jwt.verify(token, secret);
        const userId = decoded.user?.id || decoded.agentId;

        const sessions = await SecuritySession.find({ userId, isActive: true }).sort({ lastActive: -1 });
        res.json(sessions);
    } catch (err) {
        console.error('GET /auth/sessions error:', err);
        res.status(401).json({ msg: 'Token is invalid' });
    }
});

// @route    POST api/auth/sessions/logout-all
// @desc     Force logout all devices for current user
// @access   Private
router.post('/sessions/logout-all', async (req, res) => {
    try {
        let token = req.header('x-auth-token');
        const authHeader = req.header('Authorization');
        if (!token && authHeader && authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

        const secret = process.env.JWT_SECRET;
        if (!secret) return res.status(500).json({ msg: 'Server configuration error' });
        const decoded = jwt.verify(token, secret);
        const userId = decoded.user?.id || decoded.agentId;

        await SecuritySession.updateMany({ userId, isActive: true }, { isActive: false });

        await AuditLog.create({
            userId,
            action: 'logout_all',
            ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
            status: 'success',
            details: 'Forced logout on all active devices'
        }).catch(() => {});

        res.json({ msg: 'Logged out successfully from all active devices.' });
    } catch (err) {
        console.error('Logout all error:', err);
        res.status(500).send('Server error');
    }
});

// @route    GET api/auth/me
// @desc     Get current profile
// @access   Private
router.get('/me', async (req, res) => {
    try {
        let token = req.header('x-auth-token');
        const authHeader = req.header('Authorization') || req.header('authorization');
        if (!token && authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
        if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

        const secret = process.env.JWT_SECRET;
        if (!secret) return res.status(500).json({ message: 'Server configuration error' });
        const decoded = jwt.verify(token, secret);
        const userId = decoded.user?.id || decoded.agentId;
        if (!userId) return res.status(401).json({ message: 'Invalid token payload' });

        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.role === 'agent' || user.role === 'Agent') {
            const uStatus = (user.status || '').toLowerCase();
            if (uStatus === 'revoked') {
                return res.status(403).json({
                    title: 'Access Revoked',
                    message: 'Your agent access has been revoked. Please contact the administrator.',
                    msg: 'Your agent access has been revoked. Please contact the administrator.',
                    error: 'Access Revoked',
                    status: 'revoked',
                    isRevoked: true
                });
            }
            if (uStatus === 'suspended' || (!user.isActive && uStatus !== 'approved' && uStatus !== 'active')) {
                return res.status(403).json({
                    title: 'Account Suspended',
                    message: 'Your account has been suspended. Please contact the administrator.',
                    msg: 'Your account has been suspended. Please contact the administrator.',
                    error: 'Account Suspended',
                    status: 'suspended',
                    isSuspended: true
                });
            }
            if (uStatus === 'pending' || uStatus === 'pending_approval' || uStatus === 'under_verification' || (!user.isActive && uStatus !== 'approved')) {
                return res.status(403).json({
                    title: 'YOUR REQUEST IS UNDER REVIEW',
                    heading: 'YOUR REQUEST IS UNDER REVIEW',
                    message: 'Your agent registration request has been successfully submitted.\n\nYour request is currently under review by the administration.\n\nPlease contact the administration for further assistance.',
                    status: 'pending',
                    approvalStatus: 'PENDING',
                    registrationId: user.registrationId || 'N/A'
                });
            }
            if (uStatus === 'rejected') {
                return res.status(403).json({
                    title: 'APPLICATION REJECTED',
                    heading: 'APPLICATION REJECTED',
                    message: 'Your agent registration request has been rejected by the administration. Please contact support for further assistance.',
                    status: 'rejected',
                    approvalStatus: 'REJECTED',
                    registrationId: user.registrationId || 'N/A'
                });
            }

            const agent = {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone || '',
                role: user.level || 'pincode',
                level: user.level || 'pincode',
                registrationId: user.registrationId || '',
                kycStatus: user.status === 'approved' ? 'approved' : user.status || 'pending',
                territory: { state: user.assignedArea || '' },
                kyc: user.kyc || {},
                registrationFeePaid: user.isActive || false,
                performanceScore: 0,
                status: user.status,
                isActive: user.isActive,
                createdAt: user.createdAt
            };
            return res.json({ agent });
        }

        return res.json({ user });
    } catch (err) {
        console.error('GET /auth/me error:', err.message);
        return res.status(401).json({ message: 'Token is not valid' });
    }
});

module.exports = router;
