const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();

// Init Middleware
app.use(express.json({ limit: '50mb', extended: true }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Request logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

// Make io accessible in routes via req.app.get('io')
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('register', (data) => {
        if (data && data.role) {
            socket.join(data.role);
            console.log(`[Socket.IO] ${socket.id} joined room: ${data.role}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
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

// Auto-seed main categories if they don't exist
const seedMainCategoriesIfNeeded = async () => {
    try {
        const Category = require('./models/Category');
        const mainCount = await Category.countDocuments({ level: 'main', isSystem: true });
        if (mainCount === 0) {
            console.log('🔄 No system categories found. Running auto-seed...');
            // Inline quick seed of just the 7 main categories
            const mains = [
                { name: 'Services', slug: 'services', description: 'Repairs, salon, cleaning, tutoring and professional services' },
                { name: 'Products', slug: 'products', description: 'Products categories and items' },
                { name: 'Daily Needs', slug: 'daily-needs', description: 'Daily Needs categories and items' },
                { name: 'Food', slug: 'food', description: 'Food categories and items' },
                { name: 'Stay', slug: 'stay', description: 'Stay categories and items' },
                { name: 'Travel', slug: 'travel', description: 'Travel categories and items' },
                { name: 'Jobs', slug: 'jobs', description: 'Jobs categories and items' }
            ];
            for (let i = 0; i < mains.length; i++) {
                await Category.create({
                    level: 'main',
                    ...mains[i],
                    parentId: null,
                    isSystem: true,
                    isEditable: false,
                    isDeletable: false,
                    isActive: true,
                    isVisible: true,
                    sortOrder: i
                });
            }
            console.log('✅ Auto-seeded 7 system-locked Main Categories');
        } else {
            console.log(`✅ ${mainCount} system Main Categories already exist`);
        }
    } catch (err) {
        console.error('Category auto-seed failed:', err.message);
    }
};

const PORT = process.env.PORT || 5000;

// Connect Database, seed admin, then start server
const startServer = async () => {
    try {
        await connectDB();
        await seedAdminUser();
        await seedMainCategoriesIfNeeded();
        server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
    } catch (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    }
};

startServer();
