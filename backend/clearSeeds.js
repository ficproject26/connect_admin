const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load Models
const User = require('./models/User');
const Pincode = require('./models/Pincode');
const Vendor = require('./models/Vendor');
const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Booking = require('./models/Booking');
const Branch = require('./models/Branch');
const WithdrawalRequest = require('./models/WithdrawalRequest');
const Banner = require('./models/Banner');
const Advertisement = require('./models/Advertisement');

dotenv.config();

const clearMockData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for clearing...');

        // Delete all agents/users except admins and selvi
        const deleteUsersResult = await User.deleteMany({
            email: { $nin: ['admin@example.com', 'north@example.com', 'south@example.com', 'selvi@gmail.com'] }
        });
        console.log(`Deleted users count: ${deleteUsersResult.deletedCount}`);

        // Delete other collections entirely
        await Pincode.deleteMany({});
        await Vendor.deleteMany({});
        await Customer.deleteMany({});
        await Order.deleteMany({});
        await Booking.deleteMany({});
        await Branch.deleteMany({});
        await WithdrawalRequest.deleteMany({});
        await Banner.deleteMany({});
        await Advertisement.deleteMany({});

        console.log('Successfully cleared all seeded mock data from database!');
        process.exit(0);
    } catch (err) {
        console.error('Error clearing database:', err);
        process.exit(1);
    }
};

clearMockData();
