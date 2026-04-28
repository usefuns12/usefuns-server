const express = require("express");
const router = express.Router();
const kpiController = require("../controllers/kpi.controller");
const { userAuth } = require("../middlewares/auth");
const { requirePermission } = require("../middlewares/roleBasedAccess");

/**
 * KPI Routes - Admin dashboard metrics
 * All routes are read-only, require admin privilege
 */

// ============================================================================
// MAIN DASHBOARDS
// ============================================================================

/**
 * GET /admin/kpi/dashboard
 * High-level overview for operations team
 * Returns: active users/hosts/agencies, financials, alerts, disputes, gifts
 */
router.get(
  "/dashboard",
  userAuth,
  requirePermission("view_analytics"),
  kpiController.getDashboardSummary
);

/**
 * GET /admin/kpi/system-health
 * Overall system health indicators
 * Returns: db status, cron health, stuck cycles, wallet mismatches, critical alerts, health score
 */
router.get(
  "/system-health",
  userAuth,
  requirePermission("view_analytics"),
  kpiController.getSystemHealth
);

// ============================================================================
// DETAILED HEALTH METRICS
// ============================================================================

/**
 * GET /admin/kpi/wallets
 * Wallet health metrics
 * Returns: total/locked/withdrawable amounts, distribution, mismatches
 */
router.get(
  "/wallet-health",
  userAuth,
  requirePermission("view_analytics"),
  kpiController.getWalletHealth
);

router.get(
  "/wallets",
  userAuth,
  requirePermission("view_analytics"),
  kpiController.getWalletHealth
);

/**
 * GET /admin/kpi/salary-cycles
 * Salary cycle status and anomalies
 * Returns: by status, zero salary, recent cycles, stuck cycles
 */
router.get(
  "/salary-cycle-health",
  userAuth,
  requirePermission("view_analytics"),
  kpiController.getSalaryCycleHealth
);

router.get(
  "/salary-cycles",
  userAuth,
  requirePermission("view_analytics"),
  kpiController.getSalaryCycleHealth
);

/**
 * GET /admin/kpi/gift-anomalies
 * Gift velocity and loop detection metrics
 * Returns: high volume senders, gift loops, receiver spikes, trend
 */
router.get(
  "/gift-anomalies",
  userAuth,
  requirePermission("view_analytics"),
  kpiController.getGiftAnomalies
);

module.exports = router;
