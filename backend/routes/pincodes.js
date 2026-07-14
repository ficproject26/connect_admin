const express = require('express');
const router = express.Router();
const Pincode = require('../models/Pincode');

// @route    GET api/pincodes
// @desc     Get all pincodes
// @access   Public
router.get('/', async (req, res) => {
    try {
        const pincodes = await Pincode.find().populate('activeAgentId', 'name');
        res.json(pincodes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route    GET api/pincodes/available
// @desc     Get available pincodes
// @access   Public
router.get('/available', async (req, res) => {
    try {
        const pincodes = await Pincode.find({ activeAgentId: null });
        res.json(pincodes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route    POST api/pincodes/seed
// @desc     Seed initial pincodes (Admin only in real app)
// @access   Public (for now)
router.post('/seed', async (req, res) => {
    const pincodes = [
        { code: '400001', name: 'Fort', district: 'Mumbai', state: 'Maharashtra' },
        { code: '110001', name: 'Connaught Place', district: 'New Delhi', state: 'Delhi' },
        { code: '560001', name: 'Bangalore GPO', district: 'Bangalore', state: 'Karnataka' },
        { code: '600001', name: 'Chennai GPO', district: 'Chennai', state: 'Tamil Nadu' },
    ];
    try {
        await Pincode.insertMany(pincodes);
        res.json({ msg: 'Pincodes seeded' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
