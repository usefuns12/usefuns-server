const express = require("express");
const router = express.Router();
const alertController = require("../controllers/alert.controller");
const { userAuth } = require("../middlewares/auth");
const { requirePermission } = require("../middlewares/roleBasedAccess");

/**
 * Alert Routes - Admin only
 * All routes require authentication and admin privilege
 */

// ============================================================================
// LIST & FILTER ALERTS
// ============================================================================

/**
 * GET /admin/alerts
 * List alerts with filtering
 * Query params: status, type, severity, referenceType, page, limit, sort
 */
router.get(
  "/",
  userAuth,
  requirePermission("view_alerts"),
  alertController.listAlerts
);

/**
 * GET /admin/alerts/stats/summary
 * Get alert statistics (must be before /:id route)
 */
router.get(
  "/stats",
  userAuth,
  requirePermission("view_alerts"),
  alertController.getAlertStats
);

router.get(
  "/stats/summary",
  userAuth,
  requirePermission("view_alerts"),
  alertController.getAlertStats
);

/**
 * GET /admin/alerts/entity/:referenceType/:referenceId
 * Get alerts for specific entity
 */
router.get(
  "/entity/:referenceType/:referenceId",
  userAuth,
  requirePermission("view_alerts"),
  alertController.getEntityAlerts
);

// ============================================================================
// GET SINGLE ALERT
// ============================================================================

/**
 * GET /admin/alerts/:id
 * Get alert details
 */
router.get(
  "/:id",
  userAuth,
  requirePermission("view_alerts"),
  alertController.getAlert
);

// ============================================================================
// UPDATE ALERTS
// ============================================================================

/**
 * PATCH /admin/alerts/:id/acknowledge
 * Mark alert as acknowledged
 * Body: { note?: string }
 */
router.post(
  "/:id/acknowledge",
  userAuth,
  requirePermission("manage_alerts"),
  alertController.acknowledgeAlert
);

router.patch(
  "/:id/acknowledge",
  userAuth,
  requirePermission("manage_alerts"),
  alertController.acknowledgeAlert
);

/**
 * PATCH /admin/alerts/:id/resolve
 * Mark alert as resolved
 * Body: { note: string, actions?: string[] }
 */
router.post(
  "/:id/resolve",
  userAuth,
  requirePermission("manage_alerts"),
  alertController.resolveAlert
);

router.patch(
  "/:id/resolve",
  userAuth,
  requirePermission("manage_alerts"),
  alertController.resolveAlert
);

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * PATCH /admin/alerts/bulk/acknowledge
 * Acknowledge multiple alerts
 * Body: { alertIds: string[], note?: string }
 */
router.patch(
  "/acknowledge-multiple",
  userAuth,
  requirePermission("manage_alerts"),
  alertController.acknowledgeMultiple
);

router.patch(
  "/bulk/acknowledge",
  userAuth,
  requirePermission("manage_alerts"),
  alertController.acknowledgeMultiple
);

/**
 * DELETE /admin/alerts/bulk/delete
 * Delete old resolved alerts
 * Query: status, daysOld
 */
router.delete(
  "/batch",
  userAuth,
  requirePermission("manage_alerts"),
  alertController.deleteAlerts
);

router.delete(
  "/bulk/delete",
  userAuth,
  requirePermission("manage_alerts"),
  alertController.deleteAlerts
);

module.exports = router;
