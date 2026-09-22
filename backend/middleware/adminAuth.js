const User = require('../models/User');

module.exports = async function(req, res, next) {
    try {
        // req.user is set by the auth middleware
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: 'Authorization denied' });
        }

        const user = await User.findById(req.user.id).select('role adminRole branchId email name status isActive');

        const activeUser = user || req.user;
        if (!activeUser) {
            return res.status(401).json({ msg: 'User not found' });
        }

        // Allow admin, superadmin, super-admin, or any adminRole
        const r = (activeUser.role || '').toLowerCase().replace(/[-_]/g, '');
        const ar = (activeUser.adminRole || '').toLowerCase().replace(/[-_]/g, '');
        const isAdmin = 
            r === 'admin' || 
            r === 'superadmin' || 
            ar === 'superadmin' || 
            ar === 'admin' ||
            ar === 'manager';

        if (!isAdmin) {
            return res.status(403).json({ msg: 'Access denied. Admin privileges required.' });
        }

        req.adminUser = activeUser;
        next();
    } catch (err) {
        console.error('Admin auth middleware error:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};
