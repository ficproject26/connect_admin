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

// Legacy seed endpoint disabled - territory must only be created via Admin Territory Management
router.post('/seed', async (req, res) => {
    res.status(403).json({ msg: 'Manual seeding disabled. Use Admin Territory Management.' });
});

module.exports = router;
