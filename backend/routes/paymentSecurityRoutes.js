const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const PaymentSecuritySettings = require('../models/PaymentSecuritySettings');
const PaymentSecurityOtp = require('../models/PaymentSecurityOtp');
const OTPVerification = require('../models/OTPVerification');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const {
    maskEmail,
    generateOtp,
    hashOtp,
    verifyOtpHash,
    sendPaymentSecurityEmail,
    sendOTPEmail
} = require('../utils/emailService');

// Helper: Ensure user is authorized Admin
const requireAdmin = async (req, res, next) => {
    try {
        let userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, msg: 'User identity not found.' });
        }
        let user = null;
        if (mongoose.Types.ObjectId.isValid(userId)) {
            user = await User.findById(userId).select('role adminRole email name');
        } else if (req.user?.email) {
            user = await User.findOne({ email: req.user.email }).select('role adminRole email name');
        }
        const roleVal = (user?.role || req.user?.role || '').toLowerCase().trim();
        const adminRoleVal = (user?.adminRole || '').toLowerCase().trim();
        const isAdmin = ['admin', 'super-admin'].includes(roleVal) || ['admin', 'super-admin'].includes(adminRoleVal);
        if (!isAdmin && user) {
            return res.status(403).json({ success: false, msg: 'Access denied: Requires Admin privileges.' });
        }
        req.adminUser = user || { _id: userId, name: req.user?.name || 'Super Admin', role: 'super-admin' };
        next();
    } catch (e) {
        if (req.user?.role === 'super-admin' || req.user?.role === 'admin') {
            req.adminUser = { _id: req.user.id || req.user._id, name: req.user.name || 'Admin', role: req.user.role };
            return next();
        }
        return res.status(500).json({ success: false, msg: 'Authorization check failed.' });
    }
};

// Helper: Log security audit
const logSecurityAudit = async (req, action, details, metadata = {}) => {
    try {
        const actorName = req.adminUser?.name || req.user?.name || 'Administrator';
        const actorId = req.adminUser?._id || req.user?._id || null;
        const actorRole = req.adminUser?.adminRole || req.adminUser?.role || 'super-admin';
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Admin Browser';

        await PaymentAuditLog.create({
            action,
            user: actorName,
            userId: actorId,
            role: actorRole,
            details,
            metadata,
            ipAddress: ip,
            userAgent
        }).catch(err => {
            console.warn('[AuditLog Warning]:', err.message);
        });
    } catch (e) {}
};

// Helper: Validate email format
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim().toLowerCase());
};

// Helper: Validate PIN
const validatePinFormat = (pin) => {
    if (!pin || typeof pin !== 'string') return { valid: false, msg: 'PIN is required.' };
    const cleanPin = pin.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
        return { valid: false, msg: 'PIN must be between 4 and 6 numeric digits.' };
    }
    // Check weak patterns
    const weakList = ['0000', '1111', '1234', '000000', '111111', '123456', '654321', '999999'];
    if (weakList.includes(cleanPin)) {
        return { valid: false, msg: 'Please select a stronger, non-sequential PIN.' };
    }
    return { valid: true, cleanPin };
};

// =========================================================================
// 1. GET STATUS: Fetch Current Payment Security Configuration
// =========================================================================
router.get('/status', [auth, requireAdmin], async (req, res) => {
    try {
        let settings = await PaymentSecuritySettings.findOne().sort({ createdAt: -1 });

        const emailConfigured = Boolean(settings && settings.paymentAuthorizationEmail && settings.emailVerified);
        const pinConfigured = Boolean(settings && settings.transactionPinHash);
        const isPinLocked = Boolean(settings && settings.pinLockedUntil && new Date(settings.pinLockedUntil) > new Date());

        let securityStatus = 'NOT_CONFIGURED';
        if (isPinLocked) {
            securityStatus = 'PIN_LOCKED';
        } else if (emailConfigured && pinConfigured) {
            securityStatus = 'ACTIVE';
        } else if (emailConfigured && !pinConfigured) {
            securityStatus = 'PIN_PENDING';
        } else {
            securityStatus = 'EMAIL_PENDING';
        }

        res.json({
            success: true,
            configured: emailConfigured && pinConfigured,
            emailConfigured,
            emailVerified: Boolean(settings?.emailVerified),
            paymentAuthorizationEmail: settings?.paymentAuthorizationEmail || '',
            maskedEmail: settings?.paymentAuthorizationEmail ? maskEmail(settings.paymentAuthorizationEmail) : '',
            pinConfigured,
            isPinLocked,
            pinLockedUntil: isPinLocked ? settings.pinLockedUntil : null,
            securityStatus,
            updatedAt: settings?.updatedAt || null
        });
    } catch (err) {
        console.error('Error fetching payment security status:', err);
        res.status(500).json({ success: false, msg: 'Server error retrieving security status' });
    }
});

// =========================================================================
// 2. FIRST-TIME EMAIL CONFIGURATION
// =========================================================================
// Step 1: Request OTP for initial email configuration
router.post('/email/setup/request-otp', [auth, requireAdmin], async (req, res) => {
    try {
        const { email } = req.body;
        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, msg: 'Please provide a valid email address.' });
        }
        const cleanEmail = email.trim().toLowerCase();

        // Check if this exact email is already verified in settings
        const existing = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (existing && existing.paymentAuthorizationEmail === cleanEmail) {
            return res.status(400).json({
                success: false,
                msg: `${cleanEmail} is already configured and verified as the payment authorization email.`
            });
        }

        // Throttling: Check last sent OTP
        const lastOtp = await PaymentSecurityOtp.findOne({
            email: cleanEmail,
            purpose: 'PAYMENT_EMAIL_SETUP',
            isUsed: false
        }).sort({ createdAt: -1 });

        const now = Date.now();
        if (lastOtp) {
            if (now - new Date(lastOtp.lastResentAt).getTime() < 30 * 1000) {
                return res.status(429).json({ success: false, msg: 'Please wait 30 seconds before requesting another code.' });
            }
            if (lastOtp.resendCount >= 5 && (now - new Date(lastOtp.createdAt).getTime() < 10 * 60 * 1000)) {
                return res.status(429).json({ success: false, msg: 'Too many OTP requests. Please wait 10 minutes.' });
            }
        }

        // Generate and Hash OTP
        const otp = generateOtp();
        const otpHash = hashOtp(otp, cleanEmail, 'PAYMENT_EMAIL_SETUP');
        const expiresAt = new Date(now + 5 * 60 * 1000); // 5 mins

        // Invalidate older setup OTPs
        await PaymentSecurityOtp.updateMany(
            { email: cleanEmail, purpose: 'PAYMENT_EMAIL_SETUP', isUsed: false },
            { $set: { isUsed: true } }
        );
        await OTPVerification.updateMany(
            { email: cleanEmail, purpose: 'PAYMENT_EMAIL_SETUP', verified: false },
            { $set: { verified: true, isUsed: true } }
        ).catch(() => {});

        // Store secure OTP record in MongoDB
        await PaymentSecurityOtp.create({
            purpose: 'PAYMENT_EMAIL_SETUP',
            userId: req.adminUser._id,
            email: cleanEmail,
            otpHash,
            expiresAt,
            resendCount: (lastOtp?.resendCount || 0) + 1,
            lastResentAt: new Date()
        });

        await OTPVerification.create({
            purpose: 'PAYMENT_EMAIL_SETUP',
            userId: req.adminUser._id,
            adminId: req.adminUser._id,
            email: cleanEmail,
            otpHash,
            expiresAt,
            attempts: 0,
            maxAttempts: 5,
            verified: false,
            isUsed: false,
            resendCount: (lastOtp?.resendCount || 0) + 1,
            lastResentAt: new Date()
        }).catch(() => {});

        // Dispatch email
        await sendPaymentSecurityEmail({
            toEmail: cleanEmail,
            purpose: 'PAYMENT_EMAIL_SETUP',
            otp
        });

        await logSecurityAudit(req, 'otp_sent', `Payment authorization email setup OTP sent to ${cleanEmail}`);

        res.json({
            success: true,
            msg: `A verification OTP has been sent to ${cleanEmail}. Valid for 5 minutes.`,
            maskedEmail: maskEmail(cleanEmail),
            expiresIn: 300
        });
    } catch (err) {
        console.error('Error requesting email setup OTP:', err);
        res.status(500).json({ success: false, msg: 'Failed to dispatch verification code.' });
    }
});

// Step 2: Verify OTP and save initial email in MongoDB
router.post('/email/setup/verify-otp', [auth, requireAdmin], async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!isValidEmail(email) || !otp || !/^\d{6}$/.test(String(otp).trim())) {
            return res.status(400).json({ success: false, msg: 'Valid email and 6-digit numeric OTP are required.' });
        }
        const cleanEmail = email.trim().toLowerCase();
        const cleanOtp = String(otp).trim();

        // Find active OTP in MongoDB
        const otpRecord = await PaymentSecurityOtp.findOne({
            email: cleanEmail,
            purpose: 'PAYMENT_EMAIL_SETUP',
            isUsed: false
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ success: false, msg: 'No active OTP request found. Please request a new code.' });
        }

        if (new Date() > new Date(otpRecord.expiresAt)) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            return res.status(400).json({ success: false, msg: 'Verification code has expired. Please request a new code.' });
        }

        if (otpRecord.attempts >= otpRecord.maxAttempts) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            await logSecurityAudit(req, 'otp_failed', `Email setup OTP locked after maximum failed attempts for ${cleanEmail}`);
            return res.status(403).json({ success: false, msg: 'Maximum verification attempts exceeded. Code invalidated.' });
        }

        const isMatch = verifyOtpHash(cleanOtp, cleanEmail, 'PAYMENT_EMAIL_SETUP', otpRecord.otpHash);
        if (!isMatch) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            await logSecurityAudit(req, 'otp_failed', `Incorrect email setup OTP for ${cleanEmail} (Attempt ${otpRecord.attempts}/${otpRecord.maxAttempts})`);
            return res.status(400).json({
                success: false,
                msg: `Invalid verification code. ${otpRecord.maxAttempts - otpRecord.attempts} attempt(s) remaining.`
            });
        }

        // OTP Validated: Invalidate single-use OTP
        otpRecord.isUsed = true;
        otpRecord.verifiedAt = new Date();
        await otpRecord.save();

        // Sync with OTPVerification model
        await OTPVerification.updateMany(
            { email: cleanEmail, purpose: 'PAYMENT_EMAIL_SETUP', verified: false },
            { $set: { verified: true, isUsed: true, verifiedAt: new Date() } }
        ).catch(() => {});

        // Atomically upsert PaymentSecuritySettings in MongoDB
        let settings = await PaymentSecuritySettings.findOne();
        if (!settings) {
            settings = new PaymentSecuritySettings({
                paymentAuthorizationEmail: cleanEmail,
                emailVerified: true,
                updatedBy: req.adminUser._id
            });
        } else {
            settings.paymentAuthorizationEmail = cleanEmail;
            settings.emailVerified = true;
            settings.updatedBy = req.adminUser._id;
        }
        await settings.save();

        await logSecurityAudit(req, 'payment_email_setup_success', `Payment authorization email verified and saved: ${cleanEmail}`);

        res.json({
            success: true,
            msg: 'Payment authorization email verified successfully.',
            paymentAuthorizationEmail: cleanEmail,
            maskedEmail: maskEmail(cleanEmail)
        });
    } catch (err) {
        console.error('Error verifying email setup OTP:', err);
        res.status(500).json({ success: false, msg: 'Server error verifying email code' });
    }
});

// =========================================================================
// 3. CHANGE PAYMENT AUTHORIZATION EMAIL (TWO-STEP VERIFICATION)
// =========================================================================
// Step 1: Send OTP to CURRENT/OLD verified email
router.post('/email/change/request-old-otp', [auth, requireAdmin], async (req, res) => {
    try {
        const settings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!settings || !settings.paymentAuthorizationEmail) {
            return res.status(400).json({ success: false, msg: 'No verified payment email is currently configured.' });
        }
        const currentEmail = settings.paymentAuthorizationEmail;

        // Check throttle
        const lastOtp = await PaymentSecurityOtp.findOne({
            email: currentEmail,
            purpose: 'PAYMENT_EMAIL_CHANGE_OLD',
            isUsed: false
        }).sort({ createdAt: -1 });

        const now = Date.now();
        if (lastOtp && (now - new Date(lastOtp.lastResentAt).getTime() < 30 * 1000)) {
            return res.status(429).json({ success: false, msg: 'Please wait 30 seconds before requesting another code.' });
        }

        const otp = generateOtp();
        const otpHash = hashOtp(otp, currentEmail, 'PAYMENT_EMAIL_CHANGE_OLD');
        const expiresAt = new Date(now + 5 * 60 * 1000);

        await PaymentSecurityOtp.updateMany(
            { email: currentEmail, purpose: 'PAYMENT_EMAIL_CHANGE_OLD', isUsed: false },
            { $set: { isUsed: true } }
        );

        await PaymentSecurityOtp.create({
            purpose: 'PAYMENT_EMAIL_CHANGE_OLD',
            userId: req.adminUser._id,
            email: currentEmail,
            otpHash,
            expiresAt,
            resendCount: (lastOtp?.resendCount || 0) + 1,
            lastResentAt: new Date()
        });

        await sendPaymentSecurityEmail({
            toEmail: currentEmail,
            purpose: 'PAYMENT_EMAIL_CHANGE_OLD',
            otp
        });

        await logSecurityAudit(req, 'otp_sent', `Email change authorization OTP sent to current email: ${currentEmail}`);

        res.json({
            success: true,
            msg: `A verification OTP has been sent to your current payment authorization email (${maskEmail(currentEmail)}).`,
            maskedEmail: maskEmail(currentEmail),
            expiresIn: 300
        });
    } catch (err) {
        console.error('Error requesting old email OTP:', err);
        res.status(500).json({ success: false, msg: 'Failed to send OTP to current email.' });
    }
});

// Step 2: Verify OTP from CURRENT/OLD email
router.post('/email/change/verify-old-otp', [auth, requireAdmin], async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
            return res.status(400).json({ success: false, msg: 'Please provide a valid 6-digit numeric OTP code.' });
        }
        const cleanOtp = String(otp).trim();

        const settings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!settings || !settings.paymentAuthorizationEmail) {
            return res.status(400).json({ success: false, msg: 'No active payment authorization email found.' });
        }
        const currentEmail = settings.paymentAuthorizationEmail;

        const otpRecord = await PaymentSecurityOtp.findOne({
            email: currentEmail,
            purpose: 'PAYMENT_EMAIL_CHANGE_OLD',
            isUsed: false
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ success: false, msg: 'No active OTP request found. Please request a new code.' });
        }

        if (new Date() > new Date(otpRecord.expiresAt)) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            return res.status(400).json({ success: false, msg: 'Verification code has expired. Please request a new code.' });
        }

        if (otpRecord.attempts >= otpRecord.maxAttempts) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            return res.status(403).json({ success: false, msg: 'Maximum verification attempts exceeded. Code invalidated.' });
        }

        const isMatch = verifyOtpHash(cleanOtp, currentEmail, 'PAYMENT_EMAIL_CHANGE_OLD', otpRecord.otpHash);
        if (!isMatch) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({
                success: false,
                msg: `Invalid verification code. ${otpRecord.maxAttempts - otpRecord.attempts} attempt(s) remaining.`
            });
        }

        // Invalidate single-use OTP
        otpRecord.isUsed = true;
        otpRecord.verifiedAt = new Date();
        await otpRecord.save();

        // Mark current email as verified for change
        settings.emailChangeOldVerified = true;
        settings.tempNewEmail = null;
        await settings.save();

        await logSecurityAudit(req, 'otp_verified', `Old payment email OTP verified successfully for ${currentEmail}`);

        res.json({
            success: true,
            msg: 'Current email verified successfully. Please enter the new payment authorization email address.'
        });
    } catch (err) {
        console.error('Error verifying old email OTP:', err);
        res.status(500).json({ success: false, msg: 'Server error verifying current email code' });
    }
});

// Step 3: Send OTP to the NEW email address
router.post('/email/change/request-new-otp', [auth, requireAdmin], async (req, res) => {
    try {
        const { newEmail } = req.body;
        if (!isValidEmail(newEmail)) {
            return res.status(400).json({ success: false, msg: 'Please provide a valid new email address.' });
        }
        const cleanNewEmail = newEmail.trim().toLowerCase();

        const settings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!settings || !settings.emailChangeOldVerified) {
            return res.status(403).json({
                success: false,
                msg: 'Unauthorized. You must verify your current email before submitting a new email.'
            });
        }

        if (cleanNewEmail === settings.paymentAuthorizationEmail) {
            return res.status(400).json({ success: false, msg: 'The new email address cannot be the same as the current email.' });
        }

        // Throttling
        const now = Date.now();
        const lastOtp = await PaymentSecurityOtp.findOne({
            email: cleanNewEmail,
            purpose: 'PAYMENT_EMAIL_CHANGE_NEW',
            isUsed: false
        }).sort({ createdAt: -1 });

        if (lastOtp && (now - new Date(lastOtp.lastResentAt).getTime() < 30 * 1000)) {
            return res.status(429).json({ success: false, msg: 'Please wait 30 seconds before requesting another code.' });
        }

        const otp = generateOtp();
        const otpHash = hashOtp(otp, cleanNewEmail, 'PAYMENT_EMAIL_CHANGE_NEW');
        const expiresAt = new Date(now + 5 * 60 * 1000);

        await PaymentSecurityOtp.updateMany(
            { email: cleanNewEmail, purpose: 'PAYMENT_EMAIL_CHANGE_NEW', isUsed: false },
            { $set: { isUsed: true } }
        );

        await PaymentSecurityOtp.create({
            purpose: 'PAYMENT_EMAIL_CHANGE_NEW',
            userId: req.adminUser._id,
            email: cleanNewEmail,
            otpHash,
            expiresAt,
            resendCount: (lastOtp?.resendCount || 0) + 1,
            lastResentAt: new Date()
        });

        // Store temp new email in settings
        settings.tempNewEmail = cleanNewEmail;
        await settings.save();

        await sendPaymentSecurityEmail({
            toEmail: cleanNewEmail,
            purpose: 'PAYMENT_EMAIL_CHANGE_NEW',
            otp
        });

        await logSecurityAudit(req, 'otp_sent', `Email change new OTP sent to new email: ${cleanNewEmail}`);

        res.json({
            success: true,
            msg: `A verification OTP has been sent to ${cleanNewEmail}.`,
            maskedEmail: maskEmail(cleanNewEmail),
            expiresIn: 300
        });
    } catch (err) {
        console.error('Error requesting new email OTP:', err);
        res.status(500).json({ success: false, msg: 'Failed to send OTP to new email address.' });
    }
});

// Step 4: Verify NEW email OTP and finalize email replacement
router.post('/email/change/verify-new-otp', [auth, requireAdmin], async (req, res) => {
    try {
        const { otp, newEmail } = req.body;
        if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
            return res.status(400).json({ success: false, msg: 'Please provide a valid 6-digit numeric OTP code.' });
        }
        const cleanOtp = String(otp).trim();

        const settings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!settings || !settings.emailChangeOldVerified) {
            return res.status(403).json({ success: false, msg: 'Unauthorized. Step 1 verification required.' });
        }

        const targetNewEmail = (newEmail || settings.tempNewEmail || '').trim().toLowerCase();
        if (!isValidEmail(targetNewEmail)) {
            return res.status(400).json({ success: false, msg: 'New email address is required.' });
        }

        const otpRecord = await PaymentSecurityOtp.findOne({
            email: targetNewEmail,
            purpose: 'PAYMENT_EMAIL_CHANGE_NEW',
            isUsed: false
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ success: false, msg: 'No active OTP request found for the new email.' });
        }

        if (new Date() > new Date(otpRecord.expiresAt)) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            return res.status(400).json({ success: false, msg: 'Verification code has expired. Please request a new code.' });
        }

        if (otpRecord.attempts >= otpRecord.maxAttempts) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            return res.status(403).json({ success: false, msg: 'Maximum verification attempts exceeded. Code invalidated.' });
        }

        const isMatch = verifyOtpHash(cleanOtp, targetNewEmail, 'PAYMENT_EMAIL_CHANGE_NEW', otpRecord.otpHash);
        if (!isMatch) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({
                success: false,
                msg: `Invalid verification code. ${otpRecord.maxAttempts - otpRecord.attempts} attempt(s) remaining.`
            });
        }

        // Single-use OTP invalidation
        otpRecord.isUsed = true;
        otpRecord.verifiedAt = new Date();
        await otpRecord.save();

        // Invalidate all previous email change OTPs
        await PaymentSecurityOtp.updateMany(
            { purpose: { $in: ['PAYMENT_EMAIL_CHANGE_OLD', 'PAYMENT_EMAIL_CHANGE_NEW'] }, isUsed: false },
            { $set: { isUsed: true } }
        );

        const oldEmail = settings.paymentAuthorizationEmail;
        settings.paymentAuthorizationEmail = targetNewEmail;
        settings.emailVerified = true;
        settings.emailChangeOldVerified = false;
        settings.tempNewEmail = null;
        settings.updatedBy = req.adminUser._id;
        await settings.save();

        await logSecurityAudit(req, 'payment_email_changed', `Payment authorization email changed from ${oldEmail} to ${targetNewEmail}`);

        res.json({
            success: true,
            msg: 'Payment authorization email changed successfully.',
            paymentAuthorizationEmail: targetNewEmail,
            maskedEmail: maskEmail(targetNewEmail)
        });
    } catch (err) {
        console.error('Error finalizing new email verification:', err);
        res.status(500).json({ success: false, msg: 'Server error completing email change' });
    }
});

// =========================================================================
// 4. TRANSACTION PIN MANAGEMENT
// =========================================================================
// Step 1: Request OTP to Set/Change Transaction PIN
router.post('/pin/setup/request-otp', [auth, requireAdmin], async (req, res) => {
    try {
        const settings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!settings || !settings.paymentAuthorizationEmail) {
            return res.status(400).json({
                success: false,
                msg: 'Payment authorization email must be configured and verified before setting a Transaction PIN.'
            });
        }
        const email = settings.paymentAuthorizationEmail;

        // Rate Limit check
        const now = Date.now();
        const lastOtp = await PaymentSecurityOtp.findOne({
            email,
            purpose: 'TRANSACTION_PIN_SETUP',
            isUsed: false
        }).sort({ createdAt: -1 });

        if (lastOtp && (now - new Date(lastOtp.lastResentAt).getTime() < 30 * 1000)) {
            return res.status(429).json({ success: false, msg: 'Please wait 30 seconds before requesting another code.' });
        }

        const otp = generateOtp();
        const otpHash = hashOtp(otp, email, 'TRANSACTION_PIN_SETUP');
        const expiresAt = new Date(now + 5 * 60 * 1000);

        await PaymentSecurityOtp.updateMany(
            { email, purpose: 'TRANSACTION_PIN_SETUP', isUsed: false },
            { $set: { isUsed: true } }
        );

        await PaymentSecurityOtp.create({
            purpose: 'TRANSACTION_PIN_SETUP',
            userId: req.adminUser._id,
            email,
            otpHash,
            expiresAt,
            resendCount: (lastOtp?.resendCount || 0) + 1,
            lastResentAt: new Date()
        });

        await sendPaymentSecurityEmail({
            toEmail: email,
            purpose: 'TRANSACTION_PIN_SETUP',
            otp
        });

        await logSecurityAudit(req, 'otp_sent', `Transaction PIN setup OTP sent to ${email}`);

        res.json({
            success: true,
            msg: `A verification OTP has been sent to your payment authorization email (${maskEmail(email)}).`,
            maskedEmail: maskEmail(email),
            expiresIn: 300
        });
    } catch (err) {
        console.error('Error requesting PIN setup OTP:', err);
        res.status(500).json({ success: false, msg: 'Failed to dispatch verification code.' });
    }
});

// Step 2: Verify OTP and Save First-time Transaction PIN
router.post('/pin/setup/verify-and-save', [auth, requireAdmin], async (req, res) => {
    try {
        const { otp, pin, confirmPin } = req.body;
        if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
            return res.status(400).json({ success: false, msg: 'Valid 6-digit verification code is required.' });
        }
        const cleanOtp = String(otp).trim();

        const pinValidation = validatePinFormat(pin);
        if (!pinValidation.valid) {
            return res.status(400).json({ success: false, msg: pinValidation.msg });
        }
        if (pinValidation.cleanPin !== String(confirmPin || '').trim()) {
            return res.status(400).json({ success: false, msg: 'Transaction PIN and Confirm PIN do not match.' });
        }

        const settings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!settings || !settings.paymentAuthorizationEmail) {
            return res.status(400).json({ success: false, msg: 'Verified payment authorization email required.' });
        }
        const email = settings.paymentAuthorizationEmail;

        const otpRecord = await PaymentSecurityOtp.findOne({
            email,
            purpose: 'TRANSACTION_PIN_SETUP',
            isUsed: false
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ success: false, msg: 'No active OTP request found. Please request a new code.' });
        }

        if (new Date() > new Date(otpRecord.expiresAt)) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            return res.status(400).json({ success: false, msg: 'Verification code has expired. Please request a new code.' });
        }

        if (otpRecord.attempts >= otpRecord.maxAttempts) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            return res.status(403).json({ success: false, msg: 'Maximum verification attempts exceeded.' });
        }

        const isMatch = verifyOtpHash(cleanOtp, email, 'TRANSACTION_PIN_SETUP', otpRecord.otpHash);
        if (!isMatch) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({
                success: false,
                msg: `Invalid verification code. ${otpRecord.maxAttempts - otpRecord.attempts} attempt(s) remaining.`
            });
        }

        // Invalidate single-use OTP
        otpRecord.isUsed = true;
        otpRecord.verifiedAt = new Date();
        await otpRecord.save();

        // Hash PIN with bcrypt
        const hashedPin = await bcrypt.hash(pinValidation.cleanPin, 10);

        settings.transactionPinHash = hashedPin;
        settings.failedPinAttempts = 0;
        settings.pinLockedUntil = null;
        settings.updatedBy = req.adminUser._id;
        await settings.save();

        // Sync with User model for backward compatibility
        try {
            await User.findByIdAndUpdate(req.adminUser._id, {
                paymentPinHash: hashedPin,
                paymentPinConfigured: true,
                paymentPinFailedAttempts: 0,
                paymentPinLockedUntil: null
            });
        } catch (uErr) {}

        await logSecurityAudit(req, 'pin_setup', 'Transaction PIN created successfully');

        res.json({
            success: true,
            msg: 'Transaction PIN created successfully.'
        });
    } catch (err) {
        console.error('Error setting transaction PIN:', err);
        res.status(500).json({ success: false, msg: 'Server error creating Transaction PIN' });
    }
});

// Request OTP to CHANGE Transaction PIN
router.post('/pin/change/request-otp', [auth, requireAdmin], async (req, res) => {
    try {
        const settings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!settings || !settings.paymentAuthorizationEmail) {
            return res.status(400).json({ success: false, msg: 'Verified payment authorization email required.' });
        }
        if (!settings.transactionPinHash) {
            return res.status(400).json({ success: false, msg: 'No existing PIN found. Please use Set Transaction PIN.' });
        }
        const email = settings.paymentAuthorizationEmail;

        const now = Date.now();
        const lastOtp = await PaymentSecurityOtp.findOne({
            email,
            purpose: 'TRANSACTION_PIN_CHANGE',
            isUsed: false
        }).sort({ createdAt: -1 });

        if (lastOtp && (now - new Date(lastOtp.lastResentAt).getTime() < 30 * 1000)) {
            return res.status(429).json({ success: false, msg: 'Please wait 30 seconds before requesting another code.' });
        }

        const otp = generateOtp();
        const otpHash = hashOtp(otp, email, 'TRANSACTION_PIN_CHANGE');
        const expiresAt = new Date(now + 5 * 60 * 1000);

        await PaymentSecurityOtp.updateMany(
            { email, purpose: 'TRANSACTION_PIN_CHANGE', isUsed: false },
            { $set: { isUsed: true } }
        );

        await PaymentSecurityOtp.create({
            purpose: 'TRANSACTION_PIN_CHANGE',
            userId: req.adminUser._id,
            email,
            otpHash,
            expiresAt,
            resendCount: (lastOtp?.resendCount || 0) + 1,
            lastResentAt: new Date()
        });

        await sendPaymentSecurityEmail({
            toEmail: email,
            purpose: 'TRANSACTION_PIN_CHANGE',
            otp
        });

        await logSecurityAudit(req, 'otp_sent', `Transaction PIN change OTP sent to ${email}`);

        res.json({
            success: true,
            msg: `A verification OTP has been sent to your payment authorization email (${maskEmail(email)}).`,
            maskedEmail: maskEmail(email),
            expiresIn: 300
        });
    } catch (err) {
        console.error('Error requesting PIN change OTP:', err);
        res.status(500).json({ success: false, msg: 'Failed to dispatch verification code.' });
    }
});

// Verify OTP and Save CHANGED Transaction PIN
router.post('/pin/change/verify-and-save', [auth, requireAdmin], async (req, res) => {
    try {
        const { otp, newPin, confirmNewPin, pin, confirmPin } = req.body;
        const targetPin = newPin || pin;
        const targetConfirm = confirmNewPin || confirmPin;

        if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
            return res.status(400).json({ success: false, msg: 'Valid 6-digit verification code is required.' });
        }
        const cleanOtp = String(otp).trim();

        const pinValidation = validatePinFormat(targetPin);
        if (!pinValidation.valid) {
            return res.status(400).json({ success: false, msg: pinValidation.msg });
        }
        if (pinValidation.cleanPin !== String(targetConfirm || '').trim()) {
            return res.status(400).json({ success: false, msg: 'New PIN and Confirm New PIN do not match.' });
        }

        const settings = await PaymentSecuritySettings.findOne({ emailVerified: true });
        if (!settings || !settings.paymentAuthorizationEmail) {
            return res.status(400).json({ success: false, msg: 'Verified payment authorization email required.' });
        }
        const email = settings.paymentAuthorizationEmail;

        const otpRecord = await PaymentSecurityOtp.findOne({
            email,
            purpose: 'TRANSACTION_PIN_CHANGE',
            isUsed: false
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ success: false, msg: 'No active OTP request found. Please request a new code.' });
        }

        if (new Date() > new Date(otpRecord.expiresAt)) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            return res.status(400).json({ success: false, msg: 'Verification code has expired. Please request a new code.' });
        }

        if (otpRecord.attempts >= otpRecord.maxAttempts) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            return res.status(403).json({ success: false, msg: 'Maximum verification attempts exceeded.' });
        }

        const isMatch = verifyOtpHash(cleanOtp, email, 'TRANSACTION_PIN_CHANGE', otpRecord.otpHash);
        if (!isMatch) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({
                success: false,
                msg: `Invalid verification code. ${otpRecord.maxAttempts - otpRecord.attempts} attempt(s) remaining.`
            });
        }

        // Single-use OTP invalidation
        otpRecord.isUsed = true;
        otpRecord.verifiedAt = new Date();
        await otpRecord.save();

        // Hash new PIN with bcrypt
        const hashedPin = await bcrypt.hash(pinValidation.cleanPin, 10);

        settings.transactionPinHash = hashedPin;
        settings.failedPinAttempts = 0;
        settings.pinLockedUntil = null;
        settings.updatedBy = req.adminUser._id;
        await settings.save();

        try {
            await User.findByIdAndUpdate(req.adminUser._id, {
                paymentPinHash: hashedPin,
                paymentPinConfigured: true,
                paymentPinFailedAttempts: 0,
                paymentPinLockedUntil: null
            });
        } catch (uErr) {}

        await logSecurityAudit(req, 'pin_setup', 'Transaction PIN changed successfully');

        res.json({
            success: true,
            msg: 'Transaction PIN changed successfully.'
        });
    } catch (err) {
        console.error('Error changing transaction PIN:', err);
        res.status(500).json({ success: false, msg: 'Server error updating Transaction PIN' });
    }
});

// =========================================================================
// 5. SECURITY AUDIT LOGS
// =========================================================================
router.get('/audit-logs', [auth, requireAdmin], async (req, res) => {
    try {
        const logs = await PaymentAuditLog.find()
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();

        res.json({
            success: true,
            logs: logs.map(l => ({
                id: l._id,
                action: l.action,
                user: l.user,
                role: l.role,
                details: l.details,
                ipAddress: l.ipAddress,
                timestamp: l.timestamp
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, msg: 'Failed to retrieve security logs' });
    }
});

module.exports = router;
