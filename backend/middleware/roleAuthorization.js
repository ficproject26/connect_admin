const mongoose = require('mongoose');
const User = require('../models/User');
const {
    getApplicationContext,
    isRoleAuthorizedForApp,
    isAccountApprovedAndActive,
    normalizeRole
} = require('../config/appRoles');

/**
 * Reusable Middleware to enforce Application Context & Role Isolation
 * 
 * Verifies:
 * 1. User authenticated identity (req.user)
 * 2. Fresh database status (not locked, not suspended, active & approved)
 * 3. Role authorization for the active application context
 */
const requireAppAuthorization = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({
                status: 'error',
                error: 'Unauthorized',
                message: 'Authentication token missing or invalid.',
                code: 'NO_AUTH_IDENTITY'
            });
        }

        let userQueryId = userId;
        if (mongoose.Types.ObjectId.isValid(userId)) {
            userQueryId = new mongoose.Types.ObjectId(userId);
        }

        const dbUser = await User.findById(userQueryId)
            .select('name email role adminRole adminLevel level status kycStatus isActive isApproved isLocked lockUntil rejectionReason assignedState assignedDistrict assignedDivision assignedPincode branchId')
            .lean();

        if (!dbUser) {
            return res.status(401).json({
                status: 'error',
                error: 'Account Not Found',
                message: 'Authenticated account could not be found.',
                code: 'USER_NOT_FOUND'
            });
        }

        // 1. Enforce Role Isolation for the active application context
        const roleAuthorized = isRoleAuthorizedForApp(dbUser.role, dbUser.adminRole, dbUser);
        if (!roleAuthorized) {
            return res.status(403).json({
                status: 'error',
                error: 'Access Denied',
                message: `Access denied: Role is not authorized for the ${getApplicationContext()} portal.`,
                code: 'ROLE_NOT_AUTHORIZED'
            });
        }

        // 2. Enforce Account Status & Approval Gating (Fail closed)
        const approvalCheck = isAccountApprovedAndActive(dbUser);
        if (!approvalCheck.authorized) {
            return res.status(403).json({
                status: 'error',
                error: approvalCheck.code === 'ACCOUNT_PENDING_APPROVAL' ? 'Account Pending Approval' : 'Access Denied',
                message: approvalCheck.message,
                code: approvalCheck.code,
                status: approvalCheck.status
            });
        }

        // Attach fresh server-authoritative user to request
        req.user = {
            id: String(dbUser._id),
            _id: String(dbUser._id),
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
            adminRole: dbUser.adminRole,
            adminLevel: dbUser.adminLevel,
            level: dbUser.level,
            status: dbUser.status,
            isActive: dbUser.isActive,
            isApproved: dbUser.isApproved
        };

        req.dbUser = dbUser;
        next();
    } catch (err) {
        console.error('[requireAppAuthorization Error]:', err);
        return res.status(500).json({
            status: 'error',
            error: 'Server Error',
            message: 'Authorization check failed due to server error.'
        });
    }
};

/**
 * Reusable Middleware Factory to enforce specific role(s) on specific routes
 * Example: requireSpecificRoles(['super-admin', 'admin'])
 */
const requireSpecificRoles = (allowedRoles = []) => {
    const normalizedAllowed = allowedRoles.map(r => normalizeRole(r));

    return async (req, res, next) => {
        try {
            const user = req.user || req.adminUser;
            if (!user) {
                return res.status(401).json({
                    status: 'error',
                    error: 'Unauthorized',
                    message: 'Authentication required.',
                    code: 'UNAUTHENTICATED'
                });
            }

            const uRole = normalizeRole(user.role);
            const uAdminRole = normalizeRole(user.adminRole);

            const hasRole = normalizedAllowed.includes(uRole) || (uAdminRole && normalizedAllowed.includes(uAdminRole));
            if (!hasRole) {
                return res.status(403).json({
                    status: 'error',
                    error: 'Forbidden',
                    message: 'Access denied: You do not possess the required administrative permission for this action.',
                    code: 'INSUFFICIENT_ROLE_PERMISSIONS'
                });
            }

            next();
        } catch (err) {
            console.error('[requireSpecificRoles Error]:', err);
            return res.status(500).json({ status: 'error', message: 'Role authorization check failed.' });
        }
    };
};

module.exports = {
    requireAppAuthorization,
    requireSpecificRoles
};
