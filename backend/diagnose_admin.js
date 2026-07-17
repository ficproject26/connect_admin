const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const diagnose = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Check if admin user exists
        const admin = await User.findOne({ email: 'admin@example.com' });
        if (!admin) {
            console.log('❌ Admin user NOT FOUND in database!');
            console.log('Creating admin user...');
            
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            
            const newAdmin = new User({
                name: 'System Admin',
                email: 'admin@example.com',
                password: hashedPassword,
                role: 'admin',
                adminRole: 'super-admin',
                level: 'state',
                status: 'approved',
                isActive: true
            });
            await newAdmin.save();
            console.log('✅ Admin user created successfully!');
        } else {
            console.log('✅ Admin user found:', {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                adminRole: admin.adminRole,
                status: admin.status,
                isActive: admin.isActive
            });

            // Test password match
            const isMatch = await bcrypt.compare('admin123', admin.password);
            console.log('Password match test (admin123):', isMatch ? '✅ PASS' : '❌ FAIL');

            if (!isMatch) {
                console.log('Resetting admin password to admin123...');
                const salt = await bcrypt.genSalt(10);
                admin.password = await bcrypt.hash('admin123', salt);
                await admin.save();
                console.log('✅ Password reset successfully!');
            }

            // Fix adminRole if not set properly
            if (admin.adminRole !== 'super-admin') {
                console.log('Fixing adminRole from', admin.adminRole, 'to super-admin...');
                admin.adminRole = 'super-admin';
                await admin.save();
                console.log('✅ adminRole fixed!');
            }

            // Fix status if not approved
            if (admin.status !== 'approved') {
                console.log('Fixing status from', admin.status, 'to approved...');
                admin.status = 'approved';
                admin.isActive = true;
                await admin.save();
                console.log('✅ Status fixed!');
            }
        }

        // List all admin users
        const allAdmins = await User.find({ role: 'admin' });
        console.log('\nAll admin users in database:');
        allAdmins.forEach(a => {
            console.log(`  - ${a.email} | adminRole: ${a.adminRole} | status: ${a.status} | isActive: ${a.isActive}`);
        });

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

diagnose();
