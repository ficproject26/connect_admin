const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const auth = require('../middleware/auth');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

// @route    POST api/payment/order
// @desc     Create Razorpay Order
// @access   Private
router.post('/order', auth, async (req, res) => {
    const { amount } = req.body;
    try {
        const options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).send('Payment Server Error');
    }
});

module.exports = router;
