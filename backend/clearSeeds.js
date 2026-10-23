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
const Query = require('./models/Query');
const SupportTicket = require('./models/SupportTicket');
const JobApplied = require('./models/JobApplied');
const CardHolder = require('./models/CardHolder');
const Transaction = require('./models/Transaction');
const Announcement = require('./models/Announcement');

dotenv.config();

const clearMockData = async () => {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/connect_db?retryWrites=true&w=majority';
        await mongoose.connect(uri);
        console.log('Connected to MongoDB for clearing...');

        // Delete all users except admin accounts
        const deleteUsersResult = await User.deleteMany({
            $and: [
                { role: { $nin: ['admin', 'super-admin', 'superadmin', 'main-admin', 'state-admin', 'district-admin', 'division-admin', 'pincode-admin', 'branch-admin', 'staff'] } },
                { adminRole: { $nin: ['admin', 'super-admin', 'superadmin', 'main-admin', 'state-admin', 'district-admin', 'division-admin', 'pincode-admin', 'branch-admin', 'staff'] } },
                { email: { $nin: ['admin@example.com', 'admin@vendor.com', 'dhanushiyasri1924@gmail.com', 'dinesh12@gmail.com', 'akash@gmail.com', 'aakash@gmail.com', 'hi@gmail.com', 'north@example.com', 'south@example.com', 'selvi@gmail.com'] } }
            ]
        });
        console.log(`Deleted users count: ${deleteUsersResult.deletedCount}`);

        // Preserve administrative territory pincodes (do not wipe)
        console.log('Preserved administrative territory pincodes in Pincode collection.');
        await Vendor.deleteMany({});
        await Customer.deleteMany({});
        await Order.deleteMany({});
        await Booking.deleteMany({});
        await Branch.deleteMany({});
        await WithdrawalRequest.deleteMany({});
        await Banner.deleteMany({});
        await Advertisement.deleteMany({});
        await Query.deleteMany({});
        await SupportTicket.deleteMany({});
        await JobApplied.deleteMany({});
        await CardHolder.deleteMany({});
        await Transaction.deleteMany({});
        await Announcement.deleteMany({});

        console.log('Successfully cleared all seeded mock data from database!');
        process.exit(0);
    } catch (err) {
        console.error('Error clearing database:', err);
        process.exit(1);
    }
};

clearMockData();
