const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const SecuritySession = require('../models/SecuritySession');

// Helper: Ensure authenticated user is an authorized Admin
const requireAdmin = (req, res, next) => {
    const role = (req.user?.role || '').toLowerCase().trim();
    const adminRole = (req.user?.adminRole || '').toLowerCase().trim();
    const isSuper = ['super-admin', 'superadmin', 'main-admin', 'mainadmin', 'admin'].includes(role) ||
                    ['super-admin', 'superadmin', 'main-admin', 'mainadmin', 'admin'].includes(adminRole);

    if (!isSuper) {
        return res.status(403).json({
            success: false,
            message: 'Unauthorized action.',
            msg: 'Unauthorized action.'
        });
    }
    next();
};

// Strict email regex matching requirement
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const clean = email.trim();
    if (clean.includes(' ') || (clean.match(/@/g) || []).length !== 1) return false;
    return EMAIL_REGEX.test(clean);
};

// Password policy validator: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const validatePasswordSecurityPolicy = (password) => {
    if (!password || typeof password !== 'string') return false;
    if (password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    if (!/[^A-Za-z0-9\s]/.test(password)) return false;
    return true;
};

// Rate limiter for credential updates
const rateLimitMap = new Map();
const credentialRateLimiter = (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
    const key = `cred_limit_${ip}_${req.user?.id || 'anon'}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 15;

    let record = rateLimitMap.get(key);
    if (!record || now - record.startTime > windowMs) {
        record = { count: 1, startTime: now };
        rateLimitMap.set(key, record);
        return next();
    }

    if (record.count >= maxAttempts) {
        return res.status(429).json({
            success: false,
            message: 'Too many credential update attempts. Please try again later.'
        });
    }

    record.count++;
    next();
};

// =========================================================================
// 1. GET /credentials: Fetch the 3 Configurable Super Admin Account Slots
// =========================================================================
router.get('/credentials', [auth, requireAdmin], async (req, res) => {
    try {
        // Query users assigned to superAdminSlot 1, 2, 3 or matching default admin emails
        const slottedUsers = await User.find({
            $or: [
                { superAdminSlot: { $in: [1, 2, 3] } },
                { email: { $in: ['admin@connect.com', 'admin@example.com'] } }
            ]
        }).select('_id name email role adminRole superAdminSlot isPrimarySuperAdmin status isActive createdAt').lean();

        // Map users into slots 1, 2, 3
        const findUserForSlot = (slotNum) => {
            let u = slottedUsers.find(item => item.superAdminSlot === slotNum);
            if (!u && slotNum === 1) {
                u = slottedUsers.find(item => item.email === 'admin@connect.com');
            }
            if (!u && slotNum === 2) {
                u = slottedUsers.find(item => item.email === 'admin@example.com');
            }
            return u;
        };

        const currentCallerId = String(req.user.id || req.user._id);
        const currentCallerEmail = (req.user.email || '').toLowerCase().trim();

        const slotDefinitions = [
            {
                slot: 1,
                slotTitle: 'User 1 — Main Admin / Primary Super Admin',
                defaultName: 'Main Admin',
                roleLabel: 'Primary Super Admin',
                isPrimary: true
            },
            {
                slot: 2,
                slotTitle: 'User 2 — Additional Super Admin',
                defaultName: 'Super Admin',
                roleLabel: 'Additional Super Admin',
                isPrimary: false
            },
            {
                slot: 3,
                slotTitle: 'User 3 — Additional Super Admin',
                defaultName: 'Additional Super Admin 2',
                roleLabel: 'Additional Super Admin',
                isPrimary: false
            }
        ];

        const accounts = slotDefinitions.map(def => {
            const userDoc = findUserForSlot(def.slot);
            const isConfigured = Boolean(userDoc && userDoc.email);
            const isActive = isConfigured && (userDoc.status === 'approved' || userDoc.status === 'active') && userDoc.isActive !== false;
            const isCurrentAccount = Boolean(
                userDoc && (
                    String(userDoc._id) === currentCallerId ||
                    userDoc.email.toLowerCase().trim() === currentCallerEmail ||
                    (req.user.superAdminSlot && req.user.superAdminSlot === def.slot)
                )
            );

            return {
                slot: def.slot,
                slotTitle: def.slotTitle,
                displayName: userDoc?.name || def.defaultName,
                role: def.roleLabel,
                email: userDoc ? userDoc.email : '',
                status: isConfigured ? (isActive ? 'Active' : 'Inactive') : 'Unconfigured',
                isPrimary: def.isPrimary,
                isConfigured,
                isCurrentAccount,
                lastUpdated: userDoc?.passwordChangedAt || userDoc?.createdAt || null
            };
        });

        const isCallerPrimary = Boolean(
            req.user.isPrimarySuperAdmin ||
            req.user.superAdminSlot === 1 ||
            currentCallerEmail === 'admin@connect.com'
        );

        return res.status(200).json({
            success: true,
            currentUser: {
                id: currentCallerId,
                email: currentCallerEmail,
                name: req.user.name,
                slot: req.user.superAdminSlot || (currentCallerEmail === 'admin@connect.com' ? 1 : (currentCallerEmail === 'admin@example.com' ? 2 : null)),
                isPrimarySuperAdmin: isCallerPrimary
            },
            accounts
        });
    } catch (err) {
        console.error('Fetch admin credentials error:', err);
        return res.status(500).json({
            success: false,
            message: 'Network/server error.'
        });
    }
});

// =========================================================================
// 2. POST /update-credentials: Secure Password & Email Update with Verification
// =========================================================================
router.post('/update-credentials', [auth, requireAdmin, credentialRateLimiter], async (req, res) => {
    try {
        const { slot, email, oldPassword, newPassword, confirmPassword } = req.body;
        const targetSlot = Number(slot);

        if (![1, 2, 3].includes(targetSlot)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid account slot.'
            });
        }

        const callerId = req.user.id || req.user._id;
        const callerEmail = (req.user.email || '').toLowerCase().trim();
        const isCallerPrimary = Boolean(
            req.user.isPrimarySuperAdmin ||
            req.user.superAdminSlot === 1 ||
            callerEmail === 'admin@connect.com'
        );

        // Security Isolation: Prevent User 2 and User 3 from modifying other accounts (Requirement 5)
        if (!isCallerPrimary) {
            const callerSlot = req.user.superAdminSlot || (callerEmail === 'admin@example.com' ? 2 : null);
            if (callerSlot !== targetSlot) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized action.'
                });
            }
        }

        // 1. Verify Old Password against currently authenticated account (Requirement 4 & 5)
        if (!oldPassword || typeof oldPassword !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Incorrect old password.'
            });
        }

        const callerUser = await User.findById(callerId).select('+password +passwordHash');
        if (!callerUser) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized action.'
            });
        }

        const currentHash = callerUser.password || callerUser.passwordHash;
        const isOldPasswordValid = currentHash ? await bcrypt.compare(oldPassword, currentHash) : false;
        if (!isOldPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Incorrect old password.'
            });
        }

        // 2. Email Validation (Requirement 3 & 7)
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format.'
            });
        }
        const normalizedEmail = email.trim().toLowerCase();

        // Find current target user for this slot
        let targetUser = await User.findOne({
            $or: [
                { superAdminSlot: targetSlot },
                ...(targetSlot === 1 ? [{ email: 'admin@connect.com' }] : []),
                ...(targetSlot === 2 ? [{ email: 'admin@example.com' }] : [])
            ]
        });

        // Prevent duplicate email across accounts (Requirement 3 & 7)
        const duplicateUser = await User.findOne({
            email: normalizedEmail,
            ...(targetUser ? { _id: { $ne: targetUser._id } } : {})
        });
        if (duplicateUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered.'
            });
        }

        // 3. Confirm Password Match (Requirement 4 & 7)
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Confirmation password does not match.'
            });
        }

        // 4. Password Security Requirements (Requirement 4 & 7)
        if (!validatePasswordSecurityPolicy(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'New password does not meet the security requirements.'
            });
        }

        // 5. Securely Hash New Password with bcrypt (Requirement 5)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 6. Persist or Create Target User Record (Requirement 6)
        if (targetUser) {
            targetUser.email = normalizedEmail;
            targetUser.password = hashedPassword;
            targetUser.passwordHash = hashedPassword;
            targetUser.superAdminSlot = targetSlot;
            targetUser.isPrimarySuperAdmin = (targetSlot === 1);
            targetUser.passwordChangedAt = new Date();
            targetUser.role = 'super-admin';
            targetUser.adminRole = 'super-admin';
            targetUser.adminLevel = 'main';
            targetUser.level = 'main';
            targetUser.status = 'approved';
            targetUser.isActive = true;
            targetUser.isApproved = true;
            targetUser.failedLoginAttempts = 0;
            targetUser.isLocked = false;
            targetUser.lockUntil = null;
            await targetUser.save();
        } else {
            // Secure server-side initialization of new slot (Requirement 6)
            targetUser = await User.create({
                name: targetSlot === 1 ? 'Main Admin' : (targetSlot === 2 ? 'Super Admin' : 'Additional Super Admin 2'),
                email: normalizedEmail,
                password: hashedPassword,
                passwordHash: hashedPassword,
                role: 'super-admin',
                adminRole: 'super-admin',
                adminLevel: 'main',
                level: 'main',
                superAdminSlot: targetSlot,
                isPrimarySuperAdmin: (targetSlot === 1),
                status: 'approved',
                isActive: true,
                isApproved: true,
                failedLoginAttempts: 0,
                isLocked: false,
                lockUntil: null,
                passwordChangedAt: new Date()
            });
        }

        // 7. Session Invalidation (Requirement 5)
        await SecuritySession.updateMany(
            { userId: targetUser._id, isActive: true },
            { $set: { isActive: false, revokedAt: new Date() } }
        ).catch(err => console.warn('Session invalidation note:', err.message));

        // 8. Audit Logging (Requirement 5)
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Admin Console';
        await AuditLog.create({
            userId: callerUser._id,
            userEmail: callerUser.email,
            userRole: callerUser.adminRole || callerUser.role || 'super-admin',
            action: 'password_change',
            status: 'success',
            details: `Super Admin credentials updated for User ${targetSlot} (${normalizedEmail}) by ${callerUser.email}`,
            ipAddress: clientIp,
            userAgent,
            timestamp: new Date()
        }).catch(err => console.warn('AuditLog note:', err.message));

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully.',
            slot: targetSlot,
            email: normalizedEmail
        });
    } catch (err) {
        console.error('Update admin credentials error:', err);
        return res.status(500).json({
            success: false,
            message: 'Network/server error.'
        });
    }
});

module.exports = router;
