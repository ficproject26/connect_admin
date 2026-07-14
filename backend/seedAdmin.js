const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const createAdminUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const email = 'admin@example.com';
        const password = 'admin123';

        let user = await User.findOne({ email });
        if (user) {
            console.log('Admin already exists');
            process.exit();
        }

        user = new User({
            name: 'System Admin',
            email,
            password,
            role: 'admin',
            level: 'state',
            isActive: true
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        
        await user.save();
        console.log('Admin created successfully!');
        console.log('Email: admin@example.com');
        console.log('Password: admin123');
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createAdminUser();
