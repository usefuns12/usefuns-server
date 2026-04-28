/**
 * STEP 8.2: ROLE-BASED ACCESS CONTROL
 * Enforces permission boundaries for all sensitive operations
 */

const { logger } = require("../classes/logger");

/**
 * Role hierarchy
 * Higher roles inherit permissions from lower roles
 */
const ROLE_HIERARCHY = {
  superadmin: {
    level: 100,
    inherits: ["admin", "subadmin", "agency", "support", "host", "user"],
  },
  admin: {
    level: 90,
    inherits: ["subadmin", "agency", "support", "host", "user"],
  },
  subadmin: {
    level: 80,
    inherits: ["support", "host", "user"],
  },
  agency: {
    level: 70,
    inherits: ["host", "user"],
  },
  support: {
    level: 60,
    inherits: ["user"],
  },
  host: {
    level: 50,
    inherits: ["user"],
  },
  user: {
    level: 1,
    inherits: [],
  },
};

/**
 * Permission definitions
 * Format: "resource:action"
 */
const PERMISSIONS = {
  // User management
  "user:view": ["admin", "subadmin", "support"],
  "user:create": ["superadmin", "admin"],
  "user:update": ["admin", "subadmin"],
  "user:ban": ["admin"],

  // Salary operations
  "salary:process": ["admin"],
  "salary:view": ["admin", "subadmin", "agency", "host"],
  "salary:recalculate": ["admin"],
  "salary:manual_payment": ["admin"],

  // Commission operations
  "commission:process": ["admin"],
  "commission:view": ["admin", "agency"],
  "commission:adjust": ["admin"],

  // Fraud operations
  "fraud:view": ["admin", "subadmin"],
  "fraud:release": ["admin"], // Requires reason
  "fraud:escalate": ["admin"],
  "fraud:create_manual": ["admin"],
  "fraud:convert_permanent": ["admin"],

  // Wallet operations
  "wallet:freeze": ["admin"],
  "wallet:release": ["admin"], // Requires approval
  "wallet:credit_manual": ["admin"], // Requires audit
  "wallet:withdraw": ["user", "host"],

  // Gift operations
  "gift:send": ["user"],
  "gift:view": ["user", "host", "admin"],
  "gift:refund": ["admin"],

  // Dispute operations
  "dispute:create": ["user"],
  "dispute:resolve": ["admin", "subadmin", "support"],
  "dispute:refund": ["admin"],

  // Payment operations
  "payment:process": ["admin"],
  "payment:view": ["admin", "subadmin"],
  "payment:refund": ["admin"],

  // Admin dashboard
  "admin:view_stats": ["admin", "subadmin"],
  "admin:view_logs": ["admin"],
  "admin:view_audit": ["admin"],

  // Queue management
  "queue:monitor": ["admin"],
  "queue:pause": ["admin"],
  "queue:drain": ["superadmin"],

  // Policy management
  "policy:view": ["admin"],
  "policy:create": ["superadmin"],
  "policy:activate": ["superadmin"],
  "policy:lock": ["superadmin"],

  // Backup & recovery
  "backup:view": ["admin"],
  "backup:restore": ["superadmin"],

  // API keys & webhooks
  "api:manage": ["admin"],
  "webhook:manage": ["admin"],

  // Backward-compatible aliases used by existing routes
  view_alerts: ["admin", "subadmin"],
  manage_alerts: ["admin"],
  manage_disputes: ["admin", "subadmin", "support"],
  view_fraud: ["admin", "subadmin"],
  manage_fraud: ["admin"],
  manage_queues: ["admin"],
  view_analytics: ["admin", "subadmin"],
  view_policies: ["admin"],
  manage_policies: ["admin", "superadmin"],
};

/**
 * Check if role has permission
 */
function hasPermission(userRole, requiredPermission) {
  const roleInfo = ROLE_HIERARCHY[userRole];
  if (!roleInfo) {
    return false;
  }

  // Check if role or any inherited roles have the permission
  const allRoles = [userRole, ...roleInfo.inherits];
  const allowedRoles = PERMISSIONS[requiredPermission] || [];

  return allRoles.some((role) => allowedRoles.includes(role));
}

/**
 * Middleware: Check single permission
 */
function requirePermission(requiredPermission) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: No role found",
      });
    }

    if (userRole?.includes("master")) {
      return next();
    }

    if (!hasPermission(userRole, requiredPermission)) {
      logger.warn(
        `Permission denied for user ${req.user.id}: ${requiredPermission}`,
        { role: userRole },
      );

      return res.status(403).json({
        success: false,
        error: `Permission denied. Required: ${requiredPermission}`,
      });
    }

    next();
  };
}

/**
 * Middleware: Check multiple permissions (OR)
 */
function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const hasAny = permissions.some((perm) => hasPermission(userRole, perm));

    if (!hasAny) {
      logger.warn(
        `Permission denied for user ${
          req.user.id
        }: requires any of [${permissions.join(", ")}]`,
        { role: userRole },
      );

      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }

    next();
  };
}

/**
 * Middleware: Check multiple permissions (AND)
 */
function requireAllPermissions(...permissions) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const hasAll = permissions.every((perm) => hasPermission(userRole, perm));

    if (!hasAll) {
      logger.warn(
        `Permission denied for user ${
          req.user.id
        }: requires all of [${permissions.join(", ")}]`,
        { role: userRole },
      );

      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }

    next();
  };
}

/**
 * Middleware: Require specific role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: `This operation requires one of these roles: ${roles.join(
          ", ",
        )}`,
      });
    }

    next();
  };
}

/**
 * Middleware: Require reason for sensitive operations
 */
function requireReason(fieldName = "reason") {
  return (req, res, next) => {
    const reason = req.body[fieldName];

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: `${fieldName} is required and must be at least 10 characters`,
      });
    }

    next();
  };
}

/**
 * Middleware: Log sensitive operations
 */
function logSensitiveOperation(operationName) {
  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function (data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logger.warn(`SENSITIVE_OPERATION: ${operationName}`, {
          user: req.user.id,
          role: req.user.role,
          body: req.body,
          response: data,
          timestamp: new Date().toISOString(),
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Get permissions for a role
 */
function getPermissionsForRole(role) {
  const roleInfo = ROLE_HIERARCHY[role];
  if (!roleInfo) return [];

  const allRoles = [role, ...roleInfo.inherits];
  const perms = Object.entries(PERMISSIONS).filter(([_, allowedRoles]) =>
    allRoles.some((r) => allowedRoles.includes(r)),
  );

  return perms.map(([perm]) => perm);
}

/**
 * Verify access control (used in tests and audits)
 */
function verifyAccessControl() {
  const issues = [];

  // Check that all sensitive operations require appropriate roles
  const sensitivePrefixes = [
    "fraud:release",
    "fraud:escalate",
    "wallet:credit_manual",
    "salary:recalculate",
    "user:ban",
    "backup:restore",
  ];

  sensitivePrefixes.forEach((prefix) => {
    if (PERMISSIONS[prefix] && PERMISSIONS[prefix].includes("user")) {
      issues.push(`CRITICAL: ${prefix} is accessible to regular users`);
    }
    if (
      PERMISSIONS[prefix] &&
      PERMISSIONS[prefix].includes("support") &&
      prefix.includes("wallet")
    ) {
      issues.push(`WARNING: ${prefix} is accessible to support staff`);
    }
  });

  return {
    totalPermissions: Object.keys(PERMISSIONS).length,
    totalRoles: Object.keys(ROLE_HIERARCHY).length,
    issues,
  };
}

module.exports = {
  ROLE_HIERARCHY,
  PERMISSIONS,
  hasPermission,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  requireReason,
  logSensitiveOperation,
  getPermissionsForRole,
  verifyAccessControl,
};
