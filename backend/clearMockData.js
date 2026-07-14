const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load Models
const User = require('./models/User');
const Pincode = require('./models/Pincode');
const TieUp = require('./models/TieUp');
const Branch = require('./models/Branch');
const Vendor = require('./models/Vendor');
const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Booking = require('./models/Booking');
const WithdrawalRequest = require('./models/WithdrawalRequest');
const CommissionConfig = require('./models/CommissionConfig');
const MembershipPlan = require('./models/MembershipPlan');
const Banner = require('./models/Banner');
const Advertisement = require('./models/Advertisement');

dotenv.config();

const clearMockData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB to clear mock data...');

        // 1. Delete all transactional and business data
        await Branch.deleteMany({});
        await Vendor.deleteMany({});
        await Customer.deleteMany({});
        await Order.deleteMany({});
        await Booking.deleteMany({});
        await WithdrawalRequest.deleteMany({});
        await Banner.deleteMany({});
        await Advertisement.deleteMany({});
        await TieUp.deleteMany({});
        await CommissionConfig.deleteMany({});
        await MembershipPlan.deleteMany({});

        // 2. Delete all users EXCEPT the Super Admin so you can still log in
        await User.deleteMany({ email: { $ne: 'admin@example.com' } });

        // 3. Clear active agent assignments on pincodes
        await Pincode.updateMany({}, { activeAgentId: null });

        console.log('Successfully cleared all mock data!');
        console.log('Super Admin user (admin@example.com) has been preserved.');
        process.exit();
    } catch (err) {
        console.error('Error clearing database:', err);
        process.exit(1);
    }
};

clearMockData();
