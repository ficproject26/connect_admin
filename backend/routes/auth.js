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
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'User already exists' });

        // Resolve Pincode ID from 6-digit code or assignedPincodeId
        let pincodeId = req.body.assignedPincode;
        if (!pincodeId && req.body.pincode) {
            let pinDoc = await Pincode.findOne({ code: req.body.pincode });
            if (!pinDoc) {
                pinDoc = new Pincode({
                    code: req.body.pincode,
                    name: req.body.postOffice || req.body.city || 'Connaught Place',
                    district: req.body.district || 'New Delhi',
                    state: req.body.state || 'Delhi'
                });
                await pinDoc.save();
            }
            pincodeId = pinDoc._id;
        }

        // Map KYC fields from mobile app keys to schema keys
        let kycMapped = {};
        if (req.body.kyc) {
            kycMapped = {
                aadhaarNumber: req.body.kyc.aadhaarNumber || '',
                aadhaarImage: req.body.kyc.aadhaarImage || '',
                panNumber: req.body.kyc.panNumber || 'PENDING',
                panImage: req.body.kyc.otherDocImage || req.body.kyc.panImage || '',
                selfie: req.body.kyc.selfie || '',
                businessProofImage: req.body.kyc.businessProofImage || req.body.kyc.otherDocImage || ''
            };
        }

        user = new User({ 
            name, 
            email, 
            phone: req.body.phone,
            password, 
            role: role || 'agent', 
            level: level || 'pincode',
            kyc: kycMapped,
            assignedPincode: pincodeId || null
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
                    name: user.name, 
                    role: user.role, 
                    adminRole: user.adminRole,
                    branchId: user.branchId,
                    status: user.status 
                } 
            });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
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

module.exports = router;

