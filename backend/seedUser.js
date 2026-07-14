const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const createTestUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const email = 'testagent@example.com';
        const password = 'password123';

        let user = await User.findOne({ email });
        if (user) {
            console.log('User already exists');
            process.exit();
        }

        user = new User({
            name: 'Test Agent',
            email,
            password,
            role: 'agent',
            level: 'pincode',
            isActive: true
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        
        await user.save();
        console.log('Test agent created successfully!');
        console.log('Email: testagent@example.com');
        console.log('Password: password123');
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createTestUser();
