const User = require('../models/User');

module.exports = async function(req, res, next) {
    try {
        // req.user is set by the auth middleware
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: 'Authorization denied' });
        }

        const user = await User.findById(req.user.id).select('role adminRole');

        if (!user) {
            return res.status(401).json({ msg: 'User not found' });
        }

        // Allow admin, superadmin, or any adminRole
        const isAdmin = 
            user.role === 'admin' || 
            user.role === 'Admin' || 
            user.role === 'superadmin' || 
            user.adminRole === 'superadmin' || 
            user.adminRole === 'admin' ||
            user.adminRole === 'manager';

        if (!isAdmin) {
            return res.status(403).json({ msg: 'Access denied. Admin privileges required.' });
        }

        req.adminUser = user;
        next();
    } catch (err) {
        console.error('Admin auth middleware error:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};
