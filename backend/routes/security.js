const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const SecuritySession = require('../models/SecuritySession');

// GET Security Overview Metrics
router.get('/overview', auth, async (req, res) => {
    try {
        const totalActiveSessions = await SecuritySession.countDocuments({ isActive: true });
        
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const failedLoginsToday = await AuditLog.countDocuments({
            action: 'login_failed',
            timestamp: { $gte: todayStart }
        });

        const lockedAccountsCount = await User.countDocuments({
            $or: [
                { isLocked: true },
                { lockUntil: { $gt: new Date() } }
            ]
        });

        const suspiciousActivityCount = await AuditLog.countDocuments({
            status: { $in: ['warning', 'blocked'] },
            timestamp: { $gte: todayStart }
        });

        const lockedUsers = await User.find({
            $or: [
                { isLocked: true },
                { lockUntil: { $gt: new Date() } }
            ]
        }).select('name email role failedLoginAttempts lockUntil isLocked');

        res.json({
            activeSessions: totalActiveSessions,
            failedLoginsToday,
            lockedAccountsCount,
            suspiciousActivityCount,
            lockedUsers
        });
    } catch (err) {
        console.error('Security overview error:', err);
        res.status(500).send('Server error');
    }
});

// GET Filterable Security Audit Logs Stream
router.get('/logs', auth, async (req, res) => {
    try {
        const { action, status, search, limit = 50 } = req.query;
        const filter = {};

        if (action && action !== 'all') filter.action = action;
        if (status && status !== 'all') filter.status = status;
        if (search) {
            filter.$or = [
                { userEmail: { $regex: new RegExp(search, 'i') } },
                { ipAddress: { $regex: new RegExp(search, 'i') } },
                { details: { $regex: new RegExp(search, 'i') } }
            ];
        }

        const logs = await AuditLog.find(filter)
            .sort({ timestamp: -1 })
            .limit(Number(limit))
            .populate('userId', 'name email role');

        res.json(logs);
    } catch (err) {
        console.error('Security logs error:', err);
        res.status(500).send('Server error');
    }
});

// GET Active Multi-Device Sessions
router.get('/sessions', auth, async (req, res) => {
    try {
        const sessions = await SecuritySession.find({ isActive: true })
            .sort({ lastActive: -1 })
            .populate('userId', 'name email role level');
        res.json(sessions);
    } catch (err) {
        console.error('Fetch security sessions error:', err);
        res.status(500).send('Server error');
    }
});

// POST Unlock Account
router.post('/unlock-account', auth, async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        user.isLocked = false;
        user.lockUntil = null;
        user.failedLoginAttempts = 0;
        user.requireCaptcha = false;
        await user.save();

        await AuditLog.create({
            userId: user._id,
            userEmail: user.email,
            userRole: user.role,
            action: 'account_unlocked',
            ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
            status: 'success',
            details: `Account unlocked by Admin (${req.user.id})`
        });

        res.json({ msg: 'Account unlocked successfully', user });
    } catch (err) {
        console.error('Unlock account error:', err);
        res.status(500).send('Server error');
    }
});

// POST Terminate Active Session
router.post('/terminate-session', auth, async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await SecuritySession.findById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });

        session.isActive = false;
        await session.save();

        await AuditLog.create({
            userId: session.userId,
            action: 'session_terminated',
            ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
            status: 'warning',
            details: `Session terminated forcibly by Admin (${req.user.id})`
        });

        res.json({ msg: 'Session terminated successfully' });
    } catch (err) {
        console.error('Terminate session error:', err);
        res.status(500).send('Server error');
    }
});

module.exports = router;
