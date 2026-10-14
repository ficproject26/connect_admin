const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const {
    getApplicationContext,
    isRoleAuthorizedForApp,
    isAccountApprovedAndActive
} = require('../config/appRoles');

module.exports = async function(req, res, next) {
    // 1. Get token from header (x-auth-token or Authorization: Bearer <token>)
    let token = req.header('x-auth-token');
    const authHeader = req.header('Authorization') || req.header('authorization');
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // Check if token is missing
    if (!token) {
        return res.status(401).json({
            status: 'error',
            msg: 'No token, authorization denied',
            message: 'No token, authorization denied',
            code: 'TOKEN_MISSING'
        });
    }

    // 2. Verify token strictly with environment managed secret
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('FATAL: JWT_SECRET environment variable is missing.');
            return res.status(500).json({ msg: 'Server configuration error', message: 'Server configuration error' });
        }

        const decoded = jwt.verify(token, secret);
        const tokenUser = decoded.user || { id: decoded.agentId, role: decoded.role || 'agent' };
        const userId = tokenUser.id || tokenUser._id;

        if (!userId) {
            return res.status(401).json({
                status: 'error',
                msg: 'Token payload invalid',
                message: 'Token payload invalid',
                code: 'INVALID_PAYLOAD'
            });
        }

        // 3. Authoritative Database Verification (Fresh State)
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
                msg: 'Account not found or session revoked',
                message: 'Account not found or session revoked',
                code: 'USER_NOT_FOUND'
            });
        }

        // 4. Strict Role Isolation Check for the Application Context
        const isAuthorizedForApp = isRoleAuthorizedForApp(dbUser.role, dbUser.adminRole, dbUser);
        if (!isAuthorizedForApp) {
            const context = getApplicationContext();
            return res.status(403).json({
                status: 'error',
                error: 'Access Denied',
                msg: `Access denied: Role is not authorized for the ${context} portal.`,
                message: `Access denied: Role is not authorized for the ${context} portal.`,
                code: 'ROLE_NOT_AUTHORIZED'
            });
        }

        // 5. Enforce Account Status & Mandatory Approval (Fail closed)
        const approvalCheck = isAccountApprovedAndActive(dbUser);
        if (!approvalCheck.authorized) {
            return res.status(403).json({
                status: 'error',
                error: approvalCheck.code === 'ACCOUNT_PENDING_APPROVAL' ? 'Account Pending Approval' : 'Access Denied',
                msg: approvalCheck.message,
                message: approvalCheck.message,
                code: approvalCheck.code,
                status: approvalCheck.status
            });
        }

        // 6. Attach fresh server-authoritative user to request
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
            isApproved: dbUser.isApproved,
            branchId: dbUser.branchId,
            assignedState: dbUser.assignedState,
            assignedDistrict: dbUser.assignedDistrict,
            assignedDivision: dbUser.assignedDivision,
            assignedPincode: dbUser.assignedPincode
        };
        req.dbUser = dbUser;

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 'error',
                msg: 'Token has expired, please log in again',
                message: 'Token has expired, please log in again',
                code: 'TOKEN_EXPIRED'
            });
        }
        res.status(401).json({
            status: 'error',
            msg: 'Token is not valid',
            message: 'Token is not valid',
            code: 'TOKEN_INVALID'
        });
    }
};
