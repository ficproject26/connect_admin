const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const SecurityLog = require('../models/SecurityLog');
const SecuritySession = require('../models/SecuritySession');
const User = require('../models/User');

// @route   GET /api/security/dashboard-stats
// @desc    Get real-time security dashboard metrics
// @access  Private (Admin)
router.get('/dashboard-stats', [auth, adminAuth], async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activeSessionsCount = await SecuritySession.countDocuments({ isActive: true });
    const failedLogins24h = await SecurityLog.countDocuments({
      eventType: 'FAILED_LOGIN',
      timestamp: { $gte: twentyFourHoursAgo }
    });
    const lockedAccountsCount = await User.countDocuments({ isLocked: true });
    const tempLockedCount = await User.countDocuments({ lockUntil: { $gt: new Date() } });
    const rateLimitEvents24h = await SecurityLog.countDocuments({
      eventType: 'RATE_LIMIT_EXCEEDED',
      timestamp: { $gte: twentyFourHoursAgo }
    });

    const recentCriticalLogs = await SecurityLog.find({
      threatLevel: { $in: ['warning', 'danger', 'critical'] }
    })
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      activeSessionsCount,
      failedLogins24h,
      lockedAccountsCount,
      tempLockedCount,
      rateLimitEvents24h,
      recentCriticalLogs
    });
  } catch (err) {
    console.error('Security dashboard stats error:', err);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/security/audit-logs
// @desc    Get paginated security logs with filtering
// @access  Private (Admin)
router.get('/audit-logs', [auth, adminAuth], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { eventType, threatLevel, search } = req.query;

    const filter = {};
    if (eventType && eventType !== 'all') filter.eventType = eventType;
    if (threatLevel && threatLevel !== 'all') filter.threatLevel = threatLevel;
    if (search) {
      filter.$or = [
        { email: { $regex: new RegExp(search, 'i') } },
        { ipAddress: { $regex: new RegExp(search, 'i') } },
        { details: { $regex: new RegExp(search, 'i') } }
      ];
    }

    const logs = await SecurityLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SecurityLog.countDocuments(filter);

    res.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Fetch security logs error:', err);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/security/active-sessions
// @desc    List all active user/device sessions across platform
// @access  Private (Admin)
router.get('/active-sessions', [auth, adminAuth], async (req, res) => {
  try {
    const sessions = await SecuritySession.find({ isActive: true })
      .populate('userId', 'name email role level status')
      .sort({ lastActive: -1 })
      .limit(50);

    res.json(sessions);
  } catch (err) {
    console.error('Fetch active sessions error:', err);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/security/revoke-session
// @desc    Force revoke an active session
// @access  Private (Admin)
router.post('/revoke-session', [auth, adminAuth], async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ msg: 'sessionId is required' });

    const session = await SecuritySession.findById(sessionId);
    if (!session) return res.status(404).json({ msg: 'Session not found' });

    session.isActive = false;
    await session.save();

    await SecurityLog.create({
      eventType: 'SESSION_REVOKED',
      userId: session.userId,
      email: session.email || 'User',
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      threatLevel: 'info',
      details: `Session ${sessionId} revoked by Admin`
    });

    res.json({ success: true, msg: 'Session revoked successfully' });
  } catch (err) {
    console.error('Revoke session error:', err);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/security/unlock-account
// @desc    Admin action to unlock a locked user/agent account
// @access  Private (Admin)
router.post('/unlock-account', [auth, adminAuth], async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: 'userId is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User profile not found' });

    user.isLocked = false;
    user.lockUntil = null;
    user.failedLoginAttempts = 0;
    user.requireCaptcha = false;
    await user.save();

    await SecurityLog.create({
      eventType: 'ACCOUNT_UNLOCKED',
      userId: user._id,
      email: user.email,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      threatLevel: 'info',
      details: `Account ${user.email} unlocked by Admin`
    });

    res.json({ success: true, msg: `Account for ${user.name} (${user.email}) unlocked successfully.` });
  } catch (err) {
    console.error('Unlock account error:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
