const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
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
const JobApplied = require('./models/JobApplied');
const CardHolder = require('./models/CardHolder');
const DeliveryPartner = require('./models/DeliveryPartner');
const SupportTeam = require('./models/SupportTeam');
const Category = require('./models/Category');
const Query = require('./models/Query');
const SupportTicket = require('./models/SupportTicket');
const Announcement = require('./models/Announcement');
const Transaction = require('./models/Transaction');

dotenv.config();

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB for Seeding...');

        // Clear existing data (optional, let's keep users/pincodes if needed, or clear to make it fresh)
        await Branch.deleteMany({});
        await Vendor.deleteMany({});
        await Customer.deleteMany({});
        await Order.deleteMany({});
        await Booking.deleteMany({});
        await WithdrawalRequest.deleteMany({});
        await CommissionConfig.deleteMany({});
        await MembershipPlan.deleteMany({});
        await Banner.deleteMany({});
        await Advertisement.deleteMany({});
        await Transaction.deleteMany({});
        await JobApplied.deleteMany({});
        await CardHolder.deleteMany({});
        await DeliveryPartner.deleteMany({});
        await SupportTeam.deleteMany({});
        await Category.deleteMany({});
        await Query.deleteMany({});
        await SupportTicket.deleteMany({});
        await Announcement.deleteMany({});
        
        // Keep or update existing users/pincodes to prevent login issues, but let's clear the mock agents to re-seed clean ones
        await User.deleteMany({ role: { $nin: ['Vendor', 'vendor'] } });
        await Pincode.deleteMany({});

        console.log('Cleared old collection data...');

        // 1. Create Branches
        const branch1 = new Branch({
            name: 'North Branch',
            code: 'MAM-NORTH-01',
            state: 'Delhi',
            district: 'New Delhi',
            city: 'Connaught Place',
            address: '12, Block E, Connaught Place',
            contactNumber: '011-23456789'
        });
        const branch2 = new Branch({
            name: 'South Branch',
            code: 'MAM-SOUTH-02',
            state: 'Karnataka',
            district: 'Bangalore',
            city: 'Indiranagar',
            address: '456, 100 Feet Rd, Indiranagar',
            contactNumber: '080-98765432'
        });
        const branch3 = new Branch({
            name: 'West Branch',
            code: 'MAM-WEST-03',
            state: 'Maharashtra',
            district: 'Mumbai',
            city: 'Fort',
            address: '89, Horniman Circle, Fort',
            contactNumber: '022-55554444'
        });
        await branch1.save();
        await branch2.save();
        await branch3.save();
        console.log('Branches created');

        // 2. Ensure Super Admin exists
        const salt = await bcrypt.genSalt(10);
        let superAdmin = await User.findOne({ email: 'admin@example.com' });
        if (!superAdmin) {
            superAdmin = new User({
                name: 'Super Admin',
                email: 'admin@example.com',
                password: 'admin123',
                role: 'admin',
                adminRole: 'super-admin',
                isActive: true,
                status: 'approved'
            });
            superAdmin.password = await bcrypt.hash('admin123', salt);
            await superAdmin.save();
            console.log('Super Admin created');
        }

        // 3. Create Branch Admins
        const branchAdmin1 = new User({
            name: 'North Admin',
            email: 'north@example.com',
            password: 'admin123',
            role: 'admin',
            adminRole: 'branch-admin',
            branchId: branch1._id,
            isActive: true,
            status: 'approved'
        });
        branchAdmin1.password = await bcrypt.hash('admin123', salt);
        await branchAdmin1.save();

        const branchAdmin2 = new User({
            name: 'South Admin',
            email: 'south@example.com',
            password: 'admin123',
            role: 'admin',
            adminRole: 'branch-admin',
            branchId: branch2._id,
            isActive: true,
            status: 'approved'
        });
        branchAdmin2.password = await bcrypt.hash('admin123', salt);
        await branchAdmin2.save();
        console.log('Branch Admins created');

        // 4. Create Pincodes
        const pin1 = new Pincode({ code: '110001', name: 'Connaught Place', district: 'New Delhi', state: 'Delhi', region: 'North', deliveryStatus: 'Active' });
        const pin2 = new Pincode({ code: '560001', name: 'Bangalore GPO', district: 'Bangalore', state: 'Karnataka', region: 'South', deliveryStatus: 'Active' });
        const pin3 = new Pincode({ code: '400001', name: 'Fort', district: 'Mumbai', state: 'Maharashtra', region: 'West', deliveryStatus: 'Active' });
        const pin4 = new Pincode({ code: '600001', name: 'Chennai GPO', district: 'Chennai', state: 'Tamil Nadu', region: 'South', deliveryStatus: 'Active' });
        await pin1.save();
        await pin2.save();
        await pin3.save();
        await pin4.save();
        console.log('Pincodes created');

        // 5. Create Agents
        const agent1 = new User({
            name: 'Amit Sharma',
            email: 'amit@example.com',
            phone: '9876543210',
            password: 'password123',
            role: 'agent',
            level: 'pincode',
            assignedPincode: pin1._id,
            assignedDistrict: 'New Delhi',
            branchId: branch1._id,
            status: 'approved',
            isActive: true,
            isPaid: true,
            balance: 12500,
            commissionEarned: 3500,
            vendorsAdded: 4,
            kyc: {
                aadhaarNumber: '123456789012',
                aadhaarImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
                panNumber: 'ABCDE1234F',
                panImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
                selfie: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
                businessProofImage: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=150'
            }
        });
        agent1.password = await bcrypt.hash('password123', salt);
        await agent1.save();

        const agent2 = new User({
            name: 'Vijay Kumar',
            email: 'vijay@example.com',
            phone: '9876543211',
            password: 'password123',
            role: 'agent',
            level: 'district',
            assignedDistrict: 'Bangalore',
            branchId: branch2._id,
            status: 'pending',
            isActive: false,
            isPaid: false,
            balance: 0,
            commissionEarned: 0,
            vendorsAdded: 0,
            kyc: {
                aadhaarNumber: '987654321098',
                aadhaarImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
                panNumber: 'XYZWP9876Q',
                panImage: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
                selfie: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                businessProofImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150'
            }
        });
        agent2.password = await bcrypt.hash('password123', salt);
        await agent2.save();

        // Bind agent1 as active agent to pin1
        pin1.activeAgentId = agent1._id;
        await pin1.save();
        console.log('Agents created');

        // 6. Create Membership Plans
        const plan1 = new MembershipPlan({ name: 'Silver Basic', duration: 30, price: 999, features: ['List business details', 'Basic reports', '1 Banner schedule'] });
        const plan2 = new MembershipPlan({ name: 'Gold Growth', duration: 90, price: 2499, features: ['Priority listing', 'Advanced reports', '3 Banner schedules', 'SMS alerts'] });
        const plan3 = new MembershipPlan({ name: 'Platinum Enterprise', duration: 365, price: 8999, features: ['Featured placement', 'Dedicated account manager', 'Unlimited banners', 'Premium lead reports'] });
        await plan1.save();
        await plan2.save();
        await plan3.save();
        console.log('Membership plans created');

        // 7. Create Vendors
        const vendor1 = new Vendor({
            id: 'v_apollo',
            businessName: 'Apollo City Hospital',
            category: 'Hospitals',
            branchId: branch1._id,
            agentId: agent1._id,
            contactName: 'Dr. Suresh Raina',
            phone: '9876543220',
            email: 'apollo@example.com',
            status: 'approved',
            membership: { planId: plan3._id, status: 'active', expiryDate: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000) },
            kycStatus: 'approved',
            totalOrders: 140,
            totalRevenue: 280000,
            totalBookings: 85
        });
        const vendor2 = new Vendor({
            id: 'v_royalorchid',
            businessName: 'Royal Orchid Hotel',
            category: 'Hotels',
            branchId: branch2._id,
            agentId: agent1._id,
            contactName: 'Sanjay Dutt',
            phone: '9876543221',
            email: 'royalorchid@example.com',
            status: 'pending',
            membership: { planId: plan1._id, status: 'none' },
            kycStatus: 'pending',
            totalOrders: 0,
            totalRevenue: 0,
            totalBookings: 0
        });
        const vendor3 = new Vendor({
            id: 'v_repair',
            businessName: 'Express Repair Services',
            category: 'Services',
            branchId: branch3._id,
            agentId: agent1._id,
            contactName: 'Karan Johar',
            phone: '9876543222',
            email: 'repair@example.com',
            status: 'approved',
            membership: { planId: plan2._id, status: 'active', expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
            kycStatus: 'approved',
            totalOrders: 32,
            totalRevenue: 45000,
            totalBookings: 0
        });
        await vendor1.save();
        await vendor2.save();
        await vendor3.save();
        console.log('Vendors created');

        // 8. Create Customers
        const customer1 = new Customer({ name: 'Rahul Dravid', phone: '9999888877', email: 'rahul@example.com', branchId: branch1._id });
        const customer2 = new Customer({ name: 'Sachin Tendulkar', phone: '9999888876', email: 'sachin@example.com', branchId: branch2._id });
        await customer1.save();
        await customer2.save();
        console.log('Customers created');

        // 9. Create Orders and Bookings
        const order1 = new Order({ id: 'ord_apollo_1', order_number: 'ORD-1001', vendorId: vendor1._id, customerId: customer1._id, amount: 12000, commission: 600, status: 'completed' });
        const order2 = new Order({ id: 'ord_repair_2', order_number: 'ORD-1002', vendorId: vendor3._id, customerId: customer2._id, amount: 3500, commission: 175, status: 'completed' });
        await order1.save();
        await order2.save();

        const booking1 = new Booking({ vendorId: vendor1._id, customerId: customer1._id, amount: 8000, commission: 400, status: 'completed' });
        await booking1.save();
        console.log('Orders and bookings created');

        // 10. Withdrawal Requests
        const withdraw = new WithdrawalRequest({ agentId: agent1._id, amount: 5000, status: 'pending' });
        await withdraw.save();
        console.log('Withdrawal requests created');

        // 11. Banners & Ads
        const banner1 = new Banner({ title: 'Special Summer Discount', imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600', redirectLink: '/promotions', startDate: new Date(), endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
        await banner1.save();

        const ad1 = new Advertisement({ title: 'Health Insurance Campaign', imageUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600', redirectLink: '/partner/insurance', impressions: 4800, clicks: 320, ctr: 6.67, revenue: 1540 });
        await ad1.save();
        console.log('Banners & Ads created');

        // 12. Commission Configurations
        const config1 = new CommissionConfig({ scope: 'global', type: 'percentage', value: 5 });
        const config2 = new CommissionConfig({ scope: 'branch', targetId: branch1._id, type: 'percentage', value: 7 });
        await config1.save();
        await config2.save();
        console.log('Commissions configured');

        // 13. Transactions / Payments
        const tx1 = new Transaction({ userId: superAdmin._id, title: 'Commission Payout from Apollo', amount: 600, type: 'credit', status: 'completed' });
        const tx2 = new Transaction({ userId: agent1._id, title: 'Wallet withdrawal fee', amount: 50, type: 'debit', status: 'completed' });
        const tx3 = new Transaction({ userId: agent1._id, title: 'Referral Bonus: Repair Services', amount: 175, type: 'credit', status: 'completed' });
        await tx1.save();
        await tx2.save();
        await tx3.save();
        console.log('Transactions created');

        // 14. Job Applications (Job Applied)
        const job1 = new JobApplied({ candidateName: 'Rajesh Khanna', email: 'rajesh@gmail.com', phone: '9888877777', position: 'Delivery Partner', experience: '1 Year', status: 'applied' });
        const job2 = new JobApplied({ candidateName: 'Nisha Sharma', email: 'nisha@gmail.com', phone: '9877766666', position: 'Support Executive', experience: '2 Years', status: 'interviewing' });
        const job3 = new JobApplied({ candidateName: 'Ramesh Sen', email: 'ramesh@gmail.com', phone: '9866655555', position: 'District Manager', experience: '5 Years', status: 'selected' });
        await job1.save();
        await job2.save();
        await job3.save();
        console.log('Job applications created');

        // 15. Membership Card Holders
        const holder1 = new CardHolder({ name: 'Rohit Sharma', email: 'rohit@gmail.com', phone: '9777766666', cardType: 'Platinum', cardNumber: 'FIC-PLAT-8890', expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), status: 'active' });
        const holder2 = new CardHolder({ name: 'Virat Kohli', email: 'virat@gmail.com', phone: '9666655555', cardType: 'Gold', cardNumber: 'FIC-GOLD-1122', expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), status: 'active' });
        const holder3 = new CardHolder({ name: 'Shikhar Dhawan', email: 'shikhar@gmail.com', phone: '9555544444', cardType: 'Silver', cardNumber: 'FIC-SILV-4433', expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), status: 'expired' });
        await holder1.save();
        await holder2.save();
        await holder3.save();
        console.log('Card holders created');

        // 16. Delivery Partners
        const partner1 = new DeliveryPartner({ name: 'Rahul Yadav', phone: '9444433333', email: 'rahul.y@gmail.com', vehicleType: '2-wheeler', vehicleNumber: 'DL 3C AB 1234', city: 'New Delhi', status: 'active' });
        const partner2 = new DeliveryPartner({ name: 'Deepak Singh', phone: '9333322222', email: 'deepak@gmail.com', vehicleType: '3-wheeler', vehicleNumber: 'KA 03 XY 9876', city: 'Bangalore', status: 'active' });
        await partner1.save();
        await partner2.save();
        console.log('Delivery partners created');

        // 17. Support Team
        const st1 = new SupportTeam({ name: 'Aarav Gupta', email: 'aarav.support@connect.com', phone: '9222211111', role: 'agent', status: 'active' });
        const st2 = new SupportTeam({ name: 'Pooja Mehta', email: 'pooja.support@connect.com', phone: '9111100000', role: 'supervisor', status: 'active' });
        await st1.save();
        await st2.save();
        console.log('Support team created');

        // 18. Category Management
        const cat1 = new Category({ name: 'Hospitals', description: 'Medical services and city clinics' });
        const cat2 = new Category({ name: 'Hotels', description: 'Luxury hotels and budget accommodations' });
        const cat3 = new Category({ name: 'Restaurants', description: 'Food delivery and dine-in places' });
        const cat4 = new Category({ name: 'Stores', description: 'Groceries, supermarkets, and apparel' });
        const cat5 = new Category({ name: 'Services', description: 'Repairs, salon, cleaning, and tutoring' });
        await cat1.save();
        await cat2.save();
        await cat3.save();
        await cat4.save();
        await cat5.save();
        console.log('Categories created');

        // 19. Queries (quaries)
        const q1 = new Query({ name: 'Amit Jain', email: 'amitj@gmail.com', phone: '9000099999', subject: 'Vendor payout delay', message: 'Hi team, my Apollo Hospital payout for June is still pending. Please verify.', status: 'unread' });
        const q2 = new Query({ name: 'Kavita Roy', email: 'kavita@gmail.com', phone: '8999988888', subject: 'Agent onboarding query', message: 'Hello, I want to become an agent for Connaught Place. Is it available?', status: 'read' });
        await q1.save();
        await q2.save();
        console.log('Queries created');

        // 20. Support Tickets (Support)
        const tkt1 = new SupportTicket({ ticketId: 'TKT-1001', customerName: 'Suresh Kumar', phone: '8888877777', issue: 'App crashed during payment processing', priority: 'high', status: 'open', assignedTo: 'Aarav Gupta' });
        const tkt2 = new SupportTicket({ ticketId: 'TKT-1002', customerName: 'Meena Sharma', phone: '8777766666', issue: 'Incorrect commission percentage calculated', priority: 'medium', status: 'in-progress', assignedTo: 'Pooja Mehta' });
        await tkt1.save();
        await tkt2.save();
        console.log('Support tickets created');

        // 21. Announcements
        const ann1 = new Announcement({ title: 'New Commission Policy Launching', content: 'Starting next week, global commission rates will be updated to reward top agents.', targetAudience: 'agents', isActive: true });
        const ann2 = new Announcement({ title: 'System Maintenance Scheduled', content: 'Our servers will be undergoing routine upgrades on Sunday at 2 AM IST. Expect up to 30 mins downtime.', targetAudience: 'all', isActive: true });
        await ann1.save();
        await ann2.save();
        console.log('Announcements created');

        console.log('All Seeding Completed Successfully!');
        process.exit();
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

seedDatabase();
