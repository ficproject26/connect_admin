const mongoose = require('mongoose');
const User = require('./models/User');
const Pincode = require('./models/Pincode');
const TieUp = require('./models/TieUp');
const Task = require('./models/Task');
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
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        // Let's run the exact dashboard-stats logic:
        const totalCustomers = await Customer.countDocuments({});
        const totalVendors = await Vendor.countDocuments({});
        const totalAgents = await User.countDocuments({ role: 'agent' });
        const totalDistrictAgents = await User.countDocuments({ role: 'agent', level: 'district' });
        const totalBranches = await Branch.countDocuments();
        
        const completedOrders = await Order.find({ status: 'completed' });
        const completedBookings = await Booking.find({ status: { $in: ['confirmed', 'completed'] } });
        
        const totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0) + completedBookings.reduce((sum, b) => sum + b.amount, 0);
        console.log('Stats:', { totalCustomers, totalVendors, totalAgents, totalBranches, totalRevenue });

        // Category wise revenue
        const categoryMap = {};
        const allVendors = await Vendor.find({});
        const vendorMap = {};
        allVendors.forEach(v => {
            vendorMap[v._id.toString()] = {
                category: v.category || 'Other',
                name: v.businessName,
                branchId: v.branchId,
                agentId: v.agentId
            };
        });
        console.log('Mapped vendors successfully');

    } catch (err) {
        console.error('Error running query:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
