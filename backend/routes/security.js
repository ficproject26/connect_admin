const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const SecurityLog = require('../models/SecurityLog');
const SecuritySession = require('../models/SecuritySession');
const User = require('../models/User');

const handleSecurityDashboardStats = async (req, res) => {
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
};

router.get('/dashboard-stats', [auth, adminAuth], handleSecurityDashboardStats);
router.get('/overview', [auth, adminAuth], handleSecurityDashboardStats);

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

// =========================================================================
// EMAIL OTP VERIFICATION SYSTEM (Section 6 & 7)
// =========================================================================
const OTPVerification = require('../models/OTPVerification');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const PaymentAuthorizationSession = require('../models/PaymentAuthorizationSession');
const {
  maskEmail,
  generateOtp,
  hashOtp,
  verifyOtpHash,
  sendOTPEmail
} = require('../utils/emailService');

// @route   POST /api/security/send-otp
// @desc    Generate and send single-use Email OTP for security operations
// @access  Private (Admin / Authenticated User)
router.post('/send-otp', auth, async (req, res) => {
  try {
    const { email, purpose, metadata } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid email is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address format.' });
    }

    const validPurposes = [
      'PAYMENT_AUTHORIZATION',
      'EMAIL_CHANGE_OLD',
      'EMAIL_CHANGE_NEW',
      'PIN_SETUP',
      'PIN_CHANGE',
      'PAYMENT_EMAIL_SETUP',
      'PAYMENT_EMAIL_CHANGE_OLD',
      'PAYMENT_EMAIL_CHANGE_NEW',
      'TRANSACTION_PIN_SETUP',
      'TRANSACTION_PIN_CHANGE'
    ];
    const selectedPurpose = purpose || 'PAYMENT_AUTHORIZATION';
    if (!validPurposes.includes(selectedPurpose)) {
      return res.status(400).json({ success: false, message: 'Invalid security operation purpose.' });
    }

    // Rate limiting & cooldown (30s cooldown, max 5 attempts in 10 mins)
    const now = Date.now();
    const lastOtp = await OTPVerification.findOne({
      email: cleanEmail,
      purpose: selectedPurpose,
      verified: false
    }).sort({ createdAt: -1 });

    if (lastOtp) {
      if (now - new Date(lastOtp.lastResentAt || lastOtp.createdAt).getTime() < 30 * 1000) {
        return res.status(429).json({ success: false, message: 'Please wait 30 seconds before requesting another code.' });
      }
      if (lastOtp.resendCount >= 5 && (now - new Date(lastOtp.createdAt).getTime() < 10 * 60 * 1000)) {
        return res.status(429).json({ success: false, message: 'Too many OTP requests. Please wait 10 minutes.' });
      }
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp, cleanEmail, selectedPurpose);
    const expiresMinutes = parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 5;
    const expiresAt = new Date(now + expiresMinutes * 60 * 1000);

    // Invalidate older unverified OTPs for this email and purpose
    await OTPVerification.updateMany(
      { email: cleanEmail, purpose: selectedPurpose, verified: false },
      { $set: { verified: true, isUsed: true } }
    );

    // Save in MongoDB
    const userId = req.user?.id || req.user?._id || null;
    await OTPVerification.create({
      email: cleanEmail,
      otpHash,
      purpose: selectedPurpose,
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      verified: false,
      isUsed: false,
      userId,
      adminId: userId,
      resendCount: (lastOtp?.resendCount || 0) + 1,
      lastResentAt: new Date(),
      sessionData: metadata || {}
    });

    // Send OTP via email service
    await sendOTPEmail({
      email: cleanEmail,
      otp,
      purpose: selectedPurpose,
      metadata
    });

    // Log audit
    await PaymentAuditLog.create({
      action: 'otp_sent',
      user: req.user?.name || 'Admin',
      userId,
      role: req.user?.role || 'admin',
      details: `Security OTP sent to ${cleanEmail} for ${selectedPurpose}`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || ''
    }).catch(() => {});

    res.json({
      success: true,
      message: 'OTP sent successfully',
      maskedEmail: maskEmail(cleanEmail),
      expiresIn: expiresMinutes * 60
    });
  } catch (err) {
    console.error('Error in POST /api/security/send-otp:', err.message || err);
    if (cleanEmail) {
      await OTPVerification.deleteMany({ email: cleanEmail, purpose: selectedPurpose, verified: false }).catch(() => {});
    }
    res.status(500).json({
      success: false,
      message: 'Unable to send OTP email',
      msg: 'Unable to send OTP. Please try again.'
    });
  }
});

// @route   POST /api/security/verify-otp
// @desc    Verify submitted OTP and grant short-lived authorization
// @access  Private (Admin / Authenticated User)
router.post('/verify-otp', auth, async (req, res) => {
  try {
    const { email, otp, purpose, authorizationToken } = req.body;
    if (!email || !otp || !/^\d{6}$/.test(String(otp).trim())) {
      return res.status(400).json({ success: false, message: 'Valid email and 6-digit numeric OTP are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();
    const selectedPurpose = purpose || 'PAYMENT_AUTHORIZATION';

    const otpRecord = await OTPVerification.findOne({
      email: cleanEmail,
      purpose: selectedPurpose,
      verified: false,
      isUsed: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'No active OTP request found. Please request a new code.' });
    }

    if (new Date() > new Date(otpRecord.expiresAt)) {
      otpRecord.verified = true;
      otpRecord.isUsed = true;
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      otpRecord.verified = true;
      otpRecord.isUsed = true;
      await otpRecord.save();
      return res.status(403).json({ success: false, message: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    const isMatch = verifyOtpHash(cleanOtp, cleanEmail, selectedPurpose, otpRecord.otpHash);
    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remaining = otpRecord.maxAttempts - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. Please try again. (${remaining} attempt(s) remaining)`
      });
    }

    // Mark OTP verified
    otpRecord.verified = true;
    otpRecord.isUsed = true;
    otpRecord.verifiedAt = new Date();
    await otpRecord.save();

    // Invalidate all previous unverified OTPs for this purpose and email
    await OTPVerification.updateMany(
      { email: cleanEmail, purpose: selectedPurpose, _id: { $ne: otpRecord._id } },
      { $set: { verified: true, isUsed: true } }
    );

    // If this is payment authorization, update payment authorization session
    if (authorizationToken) {
      await PaymentAuthorizationSession.updateOne(
        { authorizationToken, isExecuted: false },
        { $set: { otpVerified: true, otpVerifiedAt: new Date() } }
      );
    }

    // Log audit
    await PaymentAuditLog.create({
      action: 'otp_verified',
      user: req.user?.name || 'Admin',
      userId: req.user?.id || req.user?._id,
      role: req.user?.role || 'admin',
      details: `Security OTP verified successfully for ${cleanEmail} (${selectedPurpose})`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || ''
    }).catch(() => {});

    res.json({
      success: true,
      message: 'OTP verified successfully',
      verifiedAt: otpRecord.verifiedAt
    });
  } catch (err) {
    console.error('Error in POST /api/security/verify-otp:', err);
    res.status(500).json({ success: false, message: 'Server error verifying OTP' });
  }
});

module.exports = router;
