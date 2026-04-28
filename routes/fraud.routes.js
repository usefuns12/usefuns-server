const express = require("express");
const fraudController = require("../controllers/fraud.controller");
const { userAuth } = require("../middlewares/auth");
const { requirePermission } = require("../middlewares/roleBasedAccess");

const router = express.Router();

/**
 * STEP 6 - Fraud Action Routes
 *
 * All routes protected by admin authentication
 * All operations audited and reversible
 */

// ============================================================================
// GET ENDPOINTS
// ============================================================================

/**
 * GET /admin/fraud/actions
 * List all fraud actions with filters
 *
 * Query params:
 * - targetType: "user", "host", "wallet", "device"
 * - targetRef: The ID to filter by
 * - status: "active", "released", "expired", "converted_permanent"
 * - type: "gift_block", "wallet_freeze", etc
 * - page: 1 (default)
 * - limit: 20 (default)
 */
router.get(
  "/",
  userAuth,
  requirePermission("view_fraud"),
  fraudController.listFraudActions
);

router.get(
  "/actions",
  userAuth,
  requirePermission("view_fraud"),
  fraudController.listFraudActions
);

/**
 * GET /admin/fraud/actions/:id
 * Get detailed fraud action with full audit trail
 */
router.get(
  "/:id",
  userAuth,
  requirePermission("view_fraud"),
  fraudController.getFraudActionDetail
);

router.get(
  "/actions/:id",
  userAuth,
  requirePermission("view_fraud"),
  fraudController.getFraudActionDetail
);

/**
 * GET /admin/fraud/target/:targetType/:targetRef
 * Get all fraud actions for a specific target
 *
 * Params:
 * - targetType: "user", "host", "wallet", "device"
 * - targetRef: The ObjectId or identifier
 */
router.get(
  "/target/:targetType/:targetRef",
  userAuth,
  requirePermission("view_fraud"),
  fraudController.getTargetFraudActions
);

/**
 * GET /admin/fraud/stats
 * Get fraud statistics
 */
router.get(
  "/stats",
  userAuth,
  requirePermission("view_fraud"),
  fraudController.getFraudStats
);

// ============================================================================
// POST ENDPOINTS
// ============================================================================

/**
 * POST /admin/fraud/actions
 * Create a manual fraud action (admin can block directly)
 *
 * Body:
 * {
 *   type: "gift_block",                        // Required
 *   targetType: "user",                        // Required
 *   targetRef: "userId",                       // Required
 *   durationHours: 24,                         // Required (0 = no expiry)
 *   reason: "Suspicious activity"              // Required
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Fraud action created",
 *   data: { _id, type, targetType, ... }
 * }
 */
router.post(
  "/",
  userAuth,
  requirePermission("manage_fraud"),
  fraudController.createManualFraudAction
);

router.post(
  "/manual",
  userAuth,
  requirePermission("manage_fraud"),
  fraudController.createManualFraudAction
);

router.post(
  "/actions",
  userAuth,
  requirePermission("manage_fraud"),
  fraudController.createManualFraudAction
);

// ============================================================================
// RELEASE ENDPOINT
// ============================================================================

/**
 * POST /admin/fraud/actions/:id/release
 * Release a fraud action (make it inactive)
 *
 * Params:
 * - id: FraudAction ObjectId
 *
 * Body:
 * {
 *   reason: "User appealed successfully"  // Required - why are you releasing?
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Fraud action released",
 *   data: { updated FraudAction with status: "released" }
 * }
 */
router.post(
  "/:id/release",
  userAuth,
  requirePermission("manage_fraud"),
  fraudController.releaseFraudAction
);

router.post(
  "/actions/:id/release",
  userAuth,
  requirePermission("manage_fraud"),
  fraudController.releaseFraudAction
);

// ============================================================================
// EXTEND ENDPOINT
// ============================================================================

/**
 * POST /admin/fraud/actions/:id/extend
 * Extend a fraud action's expiry time
 *
 * Params:
 * - id: FraudAction ObjectId
 *
 * Body:
 * {
 *   durationHours: 24,                    // Required - additional hours
 *   reason: "Pattern continues"           // Required
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Fraud action extended by X hours",
 *   data: { updated FraudAction with new expiresAt }
 * }
 */
router.post(
  "/:id/extend",
  userAuth,
  requirePermission("manage_fraud"),
  fraudController.extendFraudAction
);

router.post(
  "/actions/:id/extend",
  userAuth,
  requirePermission("manage_fraud"),
  fraudController.extendFraudAction
);

// ============================================================================
// CONVERT TO PERMANENT ENDPOINT
// ============================================================================

/**
 * POST /admin/fraud/actions/:id/convert-permanent
 * Convert a temporary fraud action to permanent
 *
 * Params:
 * - id: FraudAction ObjectId
 *
 * Body:
 * {
 *   reason: "User is repeat offender",                // Required
 *   justification: "Multiple violations documented"   // Optional but recommended
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Fraud action converted to permanent",
 *   data: { updated FraudAction with status: "converted_permanent", no expiresAt }
 * }
 */
router.post(
  "/:id/permanent",
  userAuth,
  requirePermission("manage_fraud"),
  fraudController.convertFraudActionToPermanent
);

router.post(
  "/actions/:id/convert-permanent",
  userAuth,
  requirePermission("manage_fraud"),
  fraudController.convertFraudActionToPermanent
);

module.exports = router;
