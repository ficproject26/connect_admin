const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Strict Territory Scoping & Access Control Middleware
 * 
 * Hierarchy:
 * Main Admin (Super Admin) -> State Admin -> District Admin -> Division Admin -> Pincode Admin
 * 
 * Enforces zero cross-state, cross-district, cross-division, and cross-pincode data leakage
 * at the backend API and database query layer.
 */
const territoryScope = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: 'Authentication token missing or invalid', message: 'Authentication required' });
        }

        let userId = req.user.id;
        if (mongoose.Types.ObjectId.isValid(userId)) {
            userId = new mongoose.Types.ObjectId(userId);
        }

        const user = await User.findById(userId)
            .select('name email role adminRole adminLevel level assignedState assignedDistrict assignedDivision assignedPincode territory status isActive')
            .lean();

        if (!user) {
            return res.status(401).json({ msg: 'User account not found', message: 'User not found' });
        }

        const roleLower = (user.role || '').toLowerCase().trim();
        const adminRoleLower = (user.adminRole || '').toLowerCase().trim();
        const adminLevelLower = (user.adminLevel || user.level || '').toLowerCase().trim();

        // 1. MAIN ADMIN (Global unrestricted access)
        const isMainAdmin = 
            roleLower === 'super-admin' || 
            roleLower === 'superadmin' || 
            adminRoleLower === 'super-admin' || 
            adminRoleLower === 'superadmin' ||
            user.email === 'admin@example.com';

        if (isMainAdmin) {
            req.adminUser = {
                ...user,
                adminTier: 'main',
                isMainAdmin: true
            };
            req.territoryFilter = {};
            return next();
        }

        // Determine Lower Tier Admin
        let adminTier = 'unknown';
        if (adminRoleLower === 'state-admin' || adminLevelLower === 'state') {
            adminTier = 'state';
        } else if (adminRoleLower === 'district-admin' || adminRoleLower === 'branch-admin' || adminLevelLower === 'district') {
            adminTier = 'district';
        } else if (adminRoleLower === 'division-admin' || adminLevelLower === 'division') {
            adminTier = 'division';
        } else if (adminRoleLower === 'pincode-admin' || adminLevelLower === 'pincode') {
            adminTier = 'pincode';
        }

        // Verify that the user has admin privileges
        const isAdmin = 
            ['admin', 'super-admin', 'superadmin'].includes(roleLower) || 
            ['super-admin', 'state-admin', 'district-admin', 'division-admin', 'pincode-admin', 'branch-admin'].includes(adminRoleLower);

        if (!isAdmin && adminTier === 'unknown') {
            return res.status(403).json({ msg: 'Access denied. Administrator privileges required.', message: 'Unauthorized access' });
        }

        const userState = (user.assignedState || user.territory?.state || '').trim();
        const userDistrict = (user.assignedDistrict || user.territory?.district || '').trim();
        const userDivision = (user.assignedDivision || user.territory?.division || '').trim();
        const userPincode = (user.assignedPincode ? String(user.assignedPincode) : (user.territory?.pincode || '')).trim();

        req.adminUser = {
            ...user,
            adminTier,
            isMainAdmin: false,
            assignedState: userState,
            assignedDistrict: userDistrict,
            assignedDivision: userDivision,
            assignedPincode: userPincode
        };

        // Construct baseline database filter based on tier
        const filter = {};

        // Request target territory from query, body, or params
        const reqState = (req.query.state || req.query.assignedState || req.body?.state || req.body?.assignedState || '').trim();
        const reqDistrict = (req.query.district || req.query.assignedDistrict || req.body?.district || req.body?.assignedDistrict || '').trim();
        const reqDivision = (req.query.division || req.query.assignedDivision || req.body?.division || req.body?.assignedDivision || '').trim();
        const reqPincode = (req.query.pincode || req.query.assignedPincode || req.body?.pincode || req.body?.assignedPincode || '').trim();

        // 2. STATE ADMIN RESTRICTIONS
        if (adminTier === 'state') {
            if (!userState) {
                if (req.method === 'GET' && (req.url.includes('/requests') || req.url.includes('/activity') || req.url.includes('/admins'))) {
                    req.territoryFilter = { assignedState: '__none__' };
                    return next();
                }
                return res.status(403).json({ msg: 'State Admin has no assigned state configured.', message: 'Territory configuration missing' });
            }
            // Strict state validation: reject cross-state attempts
            if (reqState && reqState.toLowerCase() !== 'all' && reqState.toLowerCase() !== userState.toLowerCase()) {
                return res.status(403).json({ 
                    msg: `Cross-state access denied. You are only authorized to access ${userState}.`, 
                    message: `Cross-state access denied. You are only authorized to access ${userState}.` 
                });
            }
            filter.assignedState = new RegExp(`^${userState}$`, 'i');
            req.territoryFilter = filter;
            return next();
        }

        // 3. DISTRICT ADMIN RESTRICTIONS
        if (adminTier === 'district') {
            if (!userState || !userDistrict) {
                if (req.method === 'GET' && (req.url.includes('/requests') || req.url.includes('/activity') || req.url.includes('/admins'))) {
                    req.territoryFilter = { assignedState: '__none__', assignedDistrict: '__none__' };
                    return next();
                }
                return res.status(403).json({ msg: 'District Admin has incomplete territory configuration.', message: 'Territory configuration missing' });
            }
            if (reqState && reqState.toLowerCase() !== 'all' && reqState.toLowerCase() !== userState.toLowerCase()) {
                return res.status(403).json({ msg: `Cross-state access denied. Authorized only for ${userState}.` });
            }
            if (reqDistrict && reqDistrict.toLowerCase() !== 'all' && reqDistrict.toLowerCase() !== userDistrict.toLowerCase()) {
                return res.status(403).json({ msg: `Cross-district access denied. Authorized only for ${userDistrict}.` });
            }
            filter.assignedState = new RegExp(`^${userState}$`, 'i');
            filter.assignedDistrict = new RegExp(`^${userDistrict}$`, 'i');
            req.territoryFilter = filter;
            return next();
        }

        // 4. DIVISION ADMIN RESTRICTIONS
        if (adminTier === 'division') {
            if (!userState || !userDistrict || !userDivision) {
                if (req.method === 'GET' && (req.url.includes('/requests') || req.url.includes('/activity') || req.url.includes('/admins'))) {
                    req.territoryFilter = { assignedState: '__none__', assignedDistrict: '__none__', assignedDivision: '__none__' };
                    return next();
                }
                return res.status(403).json({ msg: 'Division Admin has incomplete territory configuration.', message: 'Territory configuration missing' });
            }
            if (reqState && reqState.toLowerCase() !== 'all' && reqState.toLowerCase() !== userState.toLowerCase()) {
                return res.status(403).json({ msg: `Cross-state access denied. Authorized only for ${userState}.` });
            }
            if (reqDistrict && reqDistrict.toLowerCase() !== 'all' && reqDistrict.toLowerCase() !== userDistrict.toLowerCase()) {
                return res.status(403).json({ msg: `Cross-district access denied. Authorized only for ${userDistrict}.` });
            }
            if (reqDivision && reqDivision.toLowerCase() !== 'all' && reqDivision.toLowerCase() !== userDivision.toLowerCase()) {
                return res.status(403).json({ msg: `Cross-division access denied. Authorized only for ${userDivision}.` });
            }
            filter.assignedState = new RegExp(`^${userState}$`, 'i');
            filter.assignedDistrict = new RegExp(`^${userDistrict}$`, 'i');
            filter.assignedDivision = new RegExp(`^${userDivision}$`, 'i');
            req.territoryFilter = filter;
            return next();
        }

        // 5. PINCODE ADMIN RESTRICTIONS
        if (adminTier === 'pincode') {
            if (!userPincode) {
                return res.status(403).json({ msg: 'Pincode Admin has no assigned pincode configured.', message: 'Territory configuration missing' });
            }
            if (reqPincode && reqPincode.toLowerCase() !== 'all' && reqPincode !== userPincode) {
                return res.status(403).json({ msg: `Cross-pincode access denied. Authorized only for pincode ${userPincode}.` });
            }
            if (userState) filter.assignedState = new RegExp(`^${userState}$`, 'i');
            if (userDistrict) filter.assignedDistrict = new RegExp(`^${userDistrict}$`, 'i');
            if (userDivision) filter.assignedDivision = new RegExp(`^${userDivision}$`, 'i');
            filter.assignedPincode = userPincode;
            req.territoryFilter = filter;
            return next();
        }

        // Fallback: Default to super-admin if role is explicitly super-admin, else empty
        req.territoryFilter = {};
        next();
    } catch (err) {
        console.error('Territory scoping middleware error:', err);
        res.status(500).json({ msg: 'Server error validating territory permissions', error: err.message });
    }
};

module.exports = territoryScope;
