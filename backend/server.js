const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

const { applySecurityHeaders, authRateLimiter, sanitizeInput } = require('./middleware/security');

// Init Security Middleware
app.use(applySecurityHeaders);
app.use(sanitizeInput);
app.use(express.json({ limit: '100mb', extended: true }));

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        return callback(null, origin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['x-auth-token', 'Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'expires', 'x-requested-with', 'Accept', 'Origin'],
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Apply Auth Rate Limiter to Auth Endpoints
app.use('/api/auth/login', authRateLimiter({ windowMs: 60 * 1000, max: 5 }));
app.use('/api/auth/send-otp', authRateLimiter({ windowMs: 60 * 1000, max: 5 }));

// Request logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => callback(null, true),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['x-auth-token', 'Content-Type', 'Authorization'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    pingTimeout: 60000,
    pingInterval: 25000
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

    socket.on('disconnect', (reason) => {
        console.log(`[Socket.IO] Client disconnected (${socket.id}): ${reason}`);
    });
});

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/auth', require('./routes/auth'));
app.use('/api/security', require('./routes/security'));
app.use('/api/admin/security', require('./routes/security'));
app.use('/api/admin/enterprise', require('./routes/enterpriseModules'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/public', require('./routes/admin'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/pincodes', require('./routes/pincodes'));
app.use('/api/payment', require('./routes/payment'));

// Top-level Route Aliases for Standard REST Paths
app.use('/api/orders', require('./routes/admin'));
app.use('/api/bookings', require('./routes/admin'));
app.use('/api/jobs', require('./routes/admin'));
app.use('/api/products', require('./routes/admin'));
app.use('/api/vendors', require('./routes/admin'));
app.use('/api/users', require('./routes/admin'));

const setCorsHeaders = (req, res) => {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    const reqHeaders = req.headers['access-control-request-headers'];
    res.setHeader('Access-Control-Allow-Headers', reqHeaders || 'x-auth-token, Content-Type, Authorization, Cache-Control, Pragma, Expires, expires, x-requested-with, Accept, Origin');
};

// 404 Handler for unmapped API routes
app.use('/api', (req, res) => {
    setCorsHeaders(req, res);
    res.status(404).json({
        success: false,
        message: `API route not found: ${req.method} ${req.originalUrl}`,
        error: 'Route Not Found'
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global Error Handler:', err);
    setCorsHeaders(req, res);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'production' ? 'Server Error' : err.stack
    });
});

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

// Auto-sync product status for all suspended vendors on server boot
const syncSuspendedVendorProductsOnBoot = async () => {
    try {
        const db = mongoose.connection.db;
        if (!db) return;

        const suspendedUsers = await db.collection('users').find({
            $or: [
                { status: { $in: ['suspended', 'Suspended', 'rejected', 'Rejected', 'inactive', 'Inactive', 'deactivated', 'Deactivated', 'blocked', 'Blocked'] } },
                { isActive: false },
                { isApproved: false }
            ]
        }).toArray();

        const suspendedVendors = await db.collection('vendors').find({
            $or: [
                { status: { $in: ['suspended', 'Suspended', 'rejected', 'Rejected', 'inactive', 'Inactive', 'deactivated', 'Deactivated', 'blocked', 'Blocked'] } },
                { isActive: false }
            ]
        }).toArray();

        const validObjectIds = [];
        const stringKeys = [];

        [...suspendedUsers, ...suspendedVendors].forEach(v => {
            if (v._id) {
                const idStr = v._id.toString();
                stringKeys.push(idStr);
                if (mongoose.Types.ObjectId.isValid(idStr)) validObjectIds.push(new mongoose.Types.ObjectId(idStr));
            }
            if (v.registrationId) stringKeys.push(v.registrationId.toString());
            if (v.vendorId) stringKeys.push(v.vendorId.toString());
            if (v.primaryBusinessId) {
                const pIdStr = v.primaryBusinessId.toString();
                stringKeys.push(pIdStr);
                if (mongoose.Types.ObjectId.isValid(pIdStr)) validObjectIds.push(new mongoose.Types.ObjectId(pIdStr));
            }
            if (Array.isArray(v.businesses)) {
                v.businesses.forEach(b => {
                    if (b._id) {
                        const bIdStr = b._id.toString();
                        stringKeys.push(bIdStr);
                        if (mongoose.Types.ObjectId.isValid(bIdStr)) validObjectIds.push(new mongoose.Types.ObjectId(bIdStr));
                    }
                });
            }
            if (v.email) stringKeys.push(v.email.toLowerCase().trim());
            if (v.phone) stringKeys.push(v.phone.replace(/\D/g, ''));
            if (v.mobileNumber) stringKeys.push(v.mobileNumber.replace(/\D/g, ''));
            if (v.businessName) stringKeys.push(v.businessName.toLowerCase().trim());
            if (v.name) stringKeys.push(v.name.toLowerCase().trim());
        });

        if (stringKeys.length > 0) {
            const rawProductColl = db.collection('products');
            const res = await rawProductColl.updateMany(
                {
                    $or: [
                        { vendorId: { $in: [...validObjectIds, ...stringKeys] } },
                        { vendor: { $in: [...validObjectIds, ...stringKeys] } },
                        { businessId: { $in: [...validObjectIds, ...stringKeys] } },
                        { vendorEmail: { $in: stringKeys.map(e => e.toLowerCase()) } },
                        { vendorPhone: { $in: stringKeys } },
                        { vendorName: { $in: stringKeys } }
                    ]
                },
                {
                    $set: {
                        isActive: false,
                        isAvailable: false,
                        vendorStatus: 'Suspended',
                        isVendorSuspended: true,
                        isSuspended: true
                    }
                }
            );
            if (res.modifiedCount > 0) {
                console.log(`✅ Synced ${res.modifiedCount} products for suspended vendors on boot`);
            }
        }
    } catch (err) {
        console.error('Suspended vendor product sync warning:', err.message);
    }
};

// Catch-all 404 handler for non-existent API routes
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.status(404).json({ status: 'error', message: `Route ${req.method} ${req.url} not found` });
});

// Global Express Error Handler with CORS headers
app.use((err, req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    console.error('Server Error:', err);
    res.status(err.status || 500).json({ status: 'error', message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5001;

// Connect Database, seed admin, then start server
const startServer = async () => {
    server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
    try {
        await connectDB();
        await seedAdminUser();
        await seedMainCategoriesIfNeeded();
        await syncSuspendedVendorProductsOnBoot();
    } catch (err) {
        console.error('Initialization warning (DB/Seed):', err.message);
    }
};

startServer();
