const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function(req, res, next) {
    // Get token from header (x-auth-token or Authorization Bearer)
    let token = req.header('x-auth-token');
    const authHeader = req.header('Authorization') || req.header('authorization');
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // Check if no token
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user || { id: decoded.agentId, role: 'agent' };

        // Suspension Access Control Check for Agents & Vendors
        if (req.user && req.user.id) {
            const dbUser = await User.findById(req.user.id).select('status isActive role rejectionReason');
            if (dbUser) {
                const uRole = (dbUser.role || '').toLowerCase();
                const uStatus = (dbUser.status || '').toLowerCase();

                if (uRole === 'agent') {
                    if (uStatus === 'suspended' || (!dbUser.isActive && uStatus !== 'approved' && uStatus !== 'active')) {
                        return res.status(403).json({
                            title: 'Account Suspended',
                            message: 'Your agent account has been suspended by the Administrator. Access to the Agent Portal has been temporarily disabled.',
                            status: 'suspended',
                            isSuspended: true
                        });
                    }
                } else if (['vendor', 'merchant'].includes(uRole)) {
                    if (uStatus === 'suspended' || uStatus === 'rejected' || (!dbUser.isActive && uStatus !== 'approved' && uStatus !== 'active')) {
                        return res.status(403).json({
                            title: 'Vendor Account Suspended',
                            message: 'Your vendor account has been suspended by the Administrator. Access to the Vendor Dashboard has been disabled. Please contact Admin.',
                            status: uStatus || 'suspended',
                            isSuspended: true
                        });
                    }
                }
            }
        }

        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
