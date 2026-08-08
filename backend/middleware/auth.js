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

        // Agent Suspension Access Control Check
        if (req.user && req.user.id) {
            const dbUser = await User.findById(req.user.id).select('status isActive role rejectionReason');
            if (dbUser && (dbUser.role === 'agent' || dbUser.role === 'Agent')) {
                const uStatus = (dbUser.status || '').toLowerCase();
                if (uStatus === 'suspended' || (!dbUser.isActive && uStatus !== 'approved')) {
                    return res.status(403).json({
                        title: 'Account Suspended',
                        message: 'Your agent account has been suspended by the Administrator. Your access to the Agent Portal has been temporarily disabled. Please contact the Administration Team to reactivate your account.',
                        status: 'suspended',
                        isSuspended: true
                    });
                }
            }
        }

        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
