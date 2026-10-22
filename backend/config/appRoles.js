/**
 * Configuration-Driven Role Isolation & Application Context Security
 * 
 * Multi-Website Ecosystem Architecture:
 * - Admin Website: Authorized for administrative roles only (Super Admin, Territory Sub-Admins, Staff).
 * - Other Portals (Vendor, Agent, Manager, Customer) have their own application contexts and authorized roles.
 * 
 * Enforces:
 * 1. Strict Role Isolation: A user registered for one role/app cannot access another portal.
 * 2. Mandatory Approval Gating: Pending, unapproved, rejected, or suspended accounts cannot access dashboards or APIs.
 * 3. Configuration-Driven: Context and allowed roles can be dynamically configured via environment variables.
 */

// Application Context: defaults to 'admin' for this repository
const getApplicationContext = () => {
    return (process.env.APPLICATION_CONTEXT || 'admin').toLowerCase().trim();
};

// Ecosystem Standard Role Mapping
const ROLE_REGISTRY = {
    admin: [
        'super-admin',
        'superadmin',
        'main-admin',
        'mainadmin',
        'admin',
        'state-admin',
        'state_admin',
        'district-admin',
        'district_admin',
        'division-admin',
        'division_admin',
        'pincode-admin',
        'pincode_admin',
        'branch-admin',
        'branch_admin',
        'staff'
    ],
    vendor: [
        'vendor',
        'merchant'
    ],
    agent: [
        'agent',
        'state_agent',
        'district_agent',
        'division_agent',
        'pincode_agent'
    ],
    manager: [
        'manager',
        'state_manager',
        'district_manager',
        'division_manager',
        'pincode_manager'
    ],
    customer: [
        'customer',
        'member'
    ]
};

// Roles strictly barred from administrative access unless explicitly configured
const EXCLUSIVELY_NON_ADMIN_ROLES = new Set([
    'customer',
    'member',
    'vendor',
    'merchant',
    'agent',
    'manager',
    'state_manager',
    'district_manager',
    'division_manager',
    'pincode_manager'
]);

/**
 * Normalizes a role string to lowercase standard format
 */
const normalizeRole = (roleStr) => {
    if (!roleStr || typeof roleStr !== 'string') return '';
    return roleStr.toLowerCase().trim().replace(/[\s_]+/g, '-');
};

/**
 * Get all authorized roles for current application context
 */
const getAllowedRoles = () => {
    const context = getApplicationContext();
    
    // Check if custom allowed roles are provided via environment variable
    if (process.env.ALLOWED_ROLES) {
        return process.env.ALLOWED_ROLES
            .split(',')
            .map(r => normalizeRole(r))
            .filter(Boolean);
    }

    const defaultRoles = ROLE_REGISTRY[context] || ROLE_REGISTRY.admin;
    return defaultRoles.map(r => normalizeRole(r));
};

/**
 * Check if a role is authorized for the current application context
 * @param {string} role - User's primary role
 * @param {string} adminRole - User's adminRole attribute (if applicable)
 * @param {object} userDoc - Complete user document for context
 */
const isRoleAuthorizedForApp = (role, adminRole, userDoc = null) => {
    const context = getApplicationContext();
    const allowed = getAllowedRoles();

    const normRole = normalizeRole(role);
    const normAdminRole = normalizeRole(adminRole);

    if (context === 'admin') {
        // If the account has an authoritative adminRole that matches allowed admin roles
        if (normAdminRole && allowed.includes(normAdminRole)) {
            return true;
        }

        // If the primary role is an allowed admin role
        if (normRole && allowed.includes(normRole)) {
            // Safety guard: Ensure it's not a non-admin role that coincidentally matched
            const rawRoleLower = String(role || '').toLowerCase().trim();
            if (!EXCLUSIVELY_NON_ADMIN_ROLES.has(rawRoleLower) && !rawRoleLower.endsWith('_manager')) {
                return true;
            }
        }

        // Check userDoc level if provided (e.g. adminLevel === 'main')
        if (userDoc) {
            const adminLevel = String(userDoc.adminLevel || '').toLowerCase().trim();
            if (['main', 'super', 'state', 'district', 'division', 'pincode'].includes(adminLevel)) {
                if (normRole.includes('admin') || normAdminRole.includes('admin')) {
                    return true;
                }
            }
        }

        return false;
    }

    // For non-admin application contexts (Vendor, Agent, Manager, Customer)
    return allowed.includes(normRole) || (normAdminRole && allowed.includes(normAdminRole));
};

/**
 * Strictly verify account active and approval status (Fail Closed)
 * @param {object} userDoc - User document from database
 */
const isAccountApprovedAndActive = (userDoc) => {
    if (!userDoc) {
        return {
            authorized: false,
            code: 'USER_NOT_FOUND',
            message: 'User account not found.',
            status: 'not_found'
        };
    }

    // 1. Check Hard Lockout
    if (userDoc.isLocked) {
        return {
            authorized: false,
            code: 'ACCOUNT_LOCKED',
            message: 'Account is locked due to excessive failed attempts. Administrative unlock required.',
            status: 'locked'
        };
    }

    // 2. Check Temporary Lockout
    if (userDoc.lockUntil && new Date(userDoc.lockUntil) > new Date()) {
        const remainingMins = Math.ceil((new Date(userDoc.lockUntil).getTime() - Date.now()) / (60 * 1000));
        return {
            authorized: false,
            code: 'TEMPORARY_LOCK',
            message: `Account is temporarily locked. Please try again in ${remainingMins} minutes.`,
            status: 'locked'
        };
    }

    const rawStatus = (userDoc.status || '').toLowerCase().trim();
    const rawKycStatus = (userDoc.kycStatus || '').toLowerCase().trim();

    // 3. Suspended, Revoked, or Inactive Accounts
    if (rawStatus === 'revoked' || rawKycStatus === 'revoked') {
        return {
            authorized: false,
            code: 'ACCOUNT_REVOKED',
            message: 'Your access has been revoked. Please contact the administrator.',
            status: 'revoked'
        };
    }

    if (rawStatus === 'suspended' || rawKycStatus === 'suspended' || rawStatus === 'deactivated') {
        return {
            authorized: false,
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account has been suspended or deactivated. Please contact the administrator.',
            status: 'suspended'
        };
    }

    // 4. Rejected Accounts
    if (rawStatus === 'rejected' || rawKycStatus === 'rejected') {
        const reason = userDoc.rejectionReason ? ` Reason: ${userDoc.rejectionReason}` : '';
        return {
            authorized: false,
            code: 'ACCOUNT_REJECTED',
            message: `Your account registration was rejected.${reason}`,
            status: 'rejected'
        };
    }

    // 5. Pending / Under Review / Unapproved Accounts (Fail Closed)
    const isPendingStatus = [
        'pending',
        'pending_approval',
        'pending approval',
        'under_review',
        'under review',
        'under_verification',
        'under verification',
        'in_review',
        'unapproved'
    ].includes(rawStatus);

    if (isPendingStatus || userDoc.isApproved === false) {
        if (rawStatus !== 'approved' && rawStatus !== 'active') {
            return {
                authorized: false,
                code: 'ACCOUNT_PENDING_APPROVAL',
                message: 'Your account is awaiting administrative approval. Access to protected features is restricted until approval is granted.',
                status: 'pending'
            };
        }
    }

    // 6. Inactive Check
    const isExplicitlyActiveOrApproved = rawStatus === 'active' || rawStatus === 'approved' || userDoc.isApproved === true;
    if (rawStatus === 'inactive' || (userDoc.isActive === false && !isExplicitlyActiveOrApproved)) {
        return {
            authorized: false,
            code: 'ACCOUNT_INACTIVE',
            message: 'Your account is currently marked inactive.',
            status: 'inactive'
        };
    }

    return { authorized: true };
};

module.exports = {
    getApplicationContext,
    getAllowedRoles,
    isRoleAuthorizedForApp,
    isAccountApprovedAndActive,
    normalizeRole
};
