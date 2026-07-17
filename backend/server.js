const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// Init Middleware
app.use(express.json({ extended: false }));
app.use(cors());

// Request logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/pincodes', require('./routes/pincodes'));
app.use('/api/payment', require('./routes/payment'));

// Auto-seed admin user if it doesn't exist
const seedAdminUser = async () => {
    try {
        const User = require('./models/User');
        const admin = await User.findOne({ email: 'admin@example.com' });
        if (!admin) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            const newAdmin = new User({
                name: 'Super Admin',
                email: 'admin@example.com',
                password: hashedPassword,
                role: 'admin',
                adminRole: 'super-admin',
                level: 'state',
                status: 'approved',
                isActive: true
            });
            await newAdmin.save();
            console.log('✅ Auto-seeded Super Admin (admin@example.com / admin123)');
        } else {
            console.log('✅ Super Admin exists in database');
        }
    } catch (err) {
        console.error('Admin seed check failed:', err.message);
    }
};

const PORT = process.env.PORT || 5000;

// Connect Database, seed admin, then start server
const startServer = async () => {
    try {
        await connectDB();
        await seedAdminUser();
        app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
    } catch (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    }
};

startServer();
