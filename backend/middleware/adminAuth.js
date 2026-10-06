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

        // Allow strictly admin, superadmin, super-admin, or adminRole admin/superadmin
        const r = (activeUser.role || '').toLowerCase().replace(/[-_]/g, '');
        const ar = (activeUser.adminRole || '').toLowerCase().replace(/[-_]/g, '');
        const isAdmin = 
            r === 'admin' || 
            r === 'superadmin' || 
            ar === 'superadmin' || 
            ar === 'admin';

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

const superAdminOnly = (req, res, next) => {
    const active = req.adminUser || req.user;
    if (!active) return res.status(401).json({ msg: 'Authorization denied' });
    const r = (active.role || '').toLowerCase().replace(/[-_]/g, '');
    const ar = (active.adminRole || '').toLowerCase().replace(/[-_]/g, '');
    if (r === 'superadmin' || ar === 'superadmin') {
        return next();
    }
    return res.status(403).json({ msg: 'Access denied. Super Admin privileges required.' });
};

module.exports.adminAuth = module.exports;
module.exports.superAdminOnly = superAdminOnly;
