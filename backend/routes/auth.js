const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Pincode = require('../models/Pincode');
const User = require('../models/User');

// @route    POST api/auth/register
// @desc     Register user
// @access   Public
router.post('/register', async (req, res) => {
    const { name, email, password, role, level } = req.body;
    try {
        const lowerEmail = (email || '').toLowerCase().trim();
        let user = await User.findOne({ email: lowerEmail });
        if (user) return res.status(400).json({ message: 'Email already registered', msg: 'User already exists' });

        if (req.body.phone) {
            let existingPhone = await User.findOne({ phone: req.body.phone });
            if (existingPhone) return res.status(400).json({ message: 'Phone number already registered', msg: 'Phone number already registered' });
        }

        // Generate unique Registration ID: REG-YYYYMMDD-XXXX
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randDigits = Math.floor(1000 + Math.random() * 9000);
        const registrationId = req.body.registrationId || `REG-${dateStr}-${randDigits}`;

        // Extract territory string
        const territory = req.body.territory || {};
        const territoryStr = territory.state || territory.district || territory.division || territory.pincode || req.body.assignedArea || '';

        // Resolve Pincode ID if pincode code is provided
        let pincodeId = req.body.assignedPincode;
        const pincodeCode = territory.pincode || req.body.pincode;
        if (!pincodeId && pincodeCode) {
            let pinDoc = await Pincode.findOne({ code: pincodeCode });
            if (!pinDoc) {
                pinDoc = new Pincode({
                    code: pincodeCode,
                    name: req.body.postOffice || req.body.city || 'Default Office',
                    district: territory.district || req.body.district || 'Default District',
                    state: territory.state || req.body.state || 'Default State'
                });
                await pinDoc.save();
            }
            pincodeId = pinDoc._id;
        }

        // Map KYC fields
        let kycMapped = {};
        const kDocs = req.body.kycDocs || req.body.kyc || {};
        kycMapped = {
            aadhaarNumber: kDocs.aadhaarNumber || '',
            aadhaarImage: kDocs.aadhaarCard || kDocs.aadhaarImage || '',
            panNumber: kDocs.panNumber || '',
            panImage: kDocs.panCard || kDocs.panImage || '',
            selfie: kDocs.passportPhoto || kDocs.selfie || '',
            businessProofImage: kDocs.signature || kDocs.businessProofImage || ''
        };

        const agentRole = role || level || 'pincode';

        user = new User({ 
            name, 
            email: lowerEmail, 
            phone: req.body.phone,
            password, 
            role: 'agent', 
            level: agentRole,
            assignedArea: territoryStr,
            registrationId,
            status: 'pending',
            isActive: false,
            kyc: kycMapped,
            assignedPincode: pincodeId || null,
            createdAt: new Date()
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        // Also sync to agents collection for dual compatibility
        try {
            const db = mongoose.connection.db;
            if (db) {
                await db.collection('agents').updateOne(
                    { email: lowerEmail },
                    {
                        $set: {
                            name,
                            email: lowerEmail,
                            phone: req.body.phone,
                            password: user.password,
                            role: agentRole,
                            registrationId,
                            territory,
                            kycStatus: 'pending',
                            registrationFeePaid: false,
                            createdAt: new Date()
                        }
                    },
                    { upsert: true }
                );
            }
        } catch (syncErr) {
            console.error("Error syncing to agents collection:", syncErr);
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
});

// @route    POST api/auth/login
// @desc     Authenticate user & get token
// @access   Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        // Check status for agents
        if (user.role === 'agent') {
            if (user.status === 'pending') {
                return res.status(403).json({ msg: 'Your account is under verification', status: 'pending' });
            }
            if (user.status === 'rejected') {
                return res.status(403).json({ msg: 'Your registration was rejected', status: 'rejected' });
            }
        }

        const payload = { user: { id: user.id, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({ 
                token, 
                user: { 
                    id: user.id, 
                    name: user.name, 
                    role: user.role, 
                    adminRole: user.adminRole,
                    branchId: user.branchId,
                    status: user.status, 
                    isActive: user.isActive 
                } 
            });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Helper to compute baseVendorType
const getBaseVendorTypeHelper = (vendorType, category, subcategory) => {
    const vt = (vendorType || '').toLowerCase();
    const cat = (category || '').toLowerCase();
    const sub = (subcategory || '').toLowerCase();

    if (vt.includes('hospital') || cat.includes('hospital') || sub.includes('hospital') || 
        vt.includes('health') || cat.includes('health') || sub.includes('health') || 
        vt.includes('doctor') || cat.includes('doctor') || sub.includes('doctor') ||
        vt.includes('medical') || cat.includes('medical') || sub.includes('medical') ||
        vt.includes('clinic') || cat.includes('clinic') || sub.includes('clinic')) {
        return 'Hospital Vendor';
    }
    if (vt.includes('hotel') || cat.includes('hotel') || sub.includes('hotel') || 
        vt.includes('stay') || cat.includes('stay') || sub.includes('stay') || 
        vt.includes('room') || cat.includes('room') || sub.includes('room') ||
        vt.includes('resort') || cat.includes('resort') || sub.includes('resort')) {
        return 'Hotel Vendor';
    }
    if (vt.includes('service') || cat.includes('service') || sub.includes('service') || 
        vt.includes('travel') || cat.includes('travel') || sub.includes('travel') || 
        vt.includes('flight') || cat.includes('flight') || sub.includes('flight') ||
        vt.includes('job') || cat.includes('job') || sub.includes('job')) {
        return 'Service Provider Vendor';
    }
    return 'Store Vendor';
};

// @route    POST api/auth/register-vendor
// @desc     Register vendor
// @access   Public
router.post('/register-vendor', async (req, res) => {
    const { email, password, businessName, contactPerson, address, vendorType, category, subcategory } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'Vendor already exists with this email' });

        const baseVendorType = getBaseVendorTypeHelper(vendorType, category, subcategory);

        user = new User({
            name: businessName || contactPerson || 'Vendor Business',
            email,
            password,
            role: 'Vendor',
            status: 'Pending',
            vendorType,
            category,
            subcategory,
            baseVendorType,
            businessName,
            contactPerson,
            address,
            isActive: false
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        const payload = { user: { id: user.id, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    baseVendorType: user.baseVendorType,
                    businessName: user.businessName
                }
            });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route    POST api/auth/login-vendor
// @desc     Authenticate vendor & get token
// @access   Public
router.post('/login-vendor', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

        if (user.role !== 'Vendor' && user.role !== 'vendor') {
            return res.status(403).json({ msg: 'Access denied. Only vendors can login here.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        if (user.status === 'Pending') {
            return res.status(403).json({ msg: 'Your account registration is Pending approval', status: 'Pending' });
        }
        if (user.status === 'Rejected') {
            return res.status(403).json({ msg: 'Your account registration was Rejected', status: 'Rejected' });
        }

        const payload = { user: { id: user.id, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    baseVendorType: user.baseVendorType,
                    businessName: user.businessName
                }
            });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route    POST api/auth/register-customer
// @desc     Register a new customer from Connect App
// @access   Public
router.post('/register-customer', async (req, res) => {
    const { name, phone, email, password, aadhaarNumber, panNumber } = req.body;
    try {
        // Validate required fields
        if (!name || !phone || !email) {
            return res.status(400).json({ msg: 'Name, phone, and email are required' });
        }

        const Customer = require('../models/Customer');

        // Check if customer already exists by phone or email
        let existing = await Customer.findOne({ $or: [{ phone }, { email }] });
        if (existing) {
            return res.status(400).json({ msg: 'Customer already registered with this phone or email' });
        }

        // Hash password if provided
        let hashedPassword = '';
        if (password) {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        // Assign to first available branch (or leave null)
        const Branch = require('../models/Branch');
        const defaultBranch = await Branch.findOne();

        const customer = new Customer({
            name,
            phone,
            email,
            password: hashedPassword,
            aadhaarNumber: aadhaarNumber || '',
            panNumber: panNumber || '',
            branchId: defaultBranch ? defaultBranch._id : undefined,
            status: 'active'
        });

        await customer.save();

        res.json({
            success: true,
            msg: 'Registration successful',
            customer: {
                id: customer._id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                status: customer.status
            }
        });
    } catch (err) {
        console.error('Customer registration error:', err.message);
        if (err.code === 11000) {
            return res.status(400).json({ msg: 'Customer already registered with this phone or email' });
        }
        res.status(500).json({ msg: 'Server error during registration' });
    }
});

module.exports = router;
