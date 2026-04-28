const models = require("../models");
const FraudAction = models.FraudAction;
const fraudEngine = require("../services/fraudEngine.service");
const logger = require("../classes").Logger(__filename);

/**
 * STEP 6.5 - Fraud Admin Controller
 *
 * Admin APIs for:
 * - Viewing fraud actions
 * - Managing actions (release, extend, convert)
 * - Creating manual blocks
 * - Statistics
 */

/**
 * GET /admin/fraud/actions
 * List all fraud actions with filters
 *
 * Query params:
 * - targetType: "user", "host", "wallet", "device"
 * - targetRef: The ID to filter by
 * - status: "active", "released", "expired", "converted_permanent"
 * - type: "gift_block", "wallet_freeze", etc
 * - page: 1-based
 * - limit: results per page
 */
async function listFraudActions(req, res) {
  try {
    const {
      targetType,
      targetRef,
      status,
      type,
      page = 1,
      limit = 20,
    } = req.query;

    const result = await fraudEngine.listFraudActions({
      targetType,
      targetRef,
      status,
      type,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    logger.info(
      `[FraudController] Admin listed fraud actions - ${result.total} total`
    );

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    });
  } catch (error) {
    logger.error(
      `[FraudController] Error listing fraud actions: ${error.message}`
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * GET /admin/fraud/actions/:id
 * Get detailed fraud action with full audit trail
 */
async function getFraudActionDetail(req, res) {
  try {
    const { id } = req.params;

    const fraudAction = await fraudEngine.getFraudActionDetail(id);

    if (!fraudAction) {
      return res.status(404).json({
        success: false,
        error: "Fraud action not found",
      });
    }

    logger.info(`[FraudController] Admin viewed fraud action: ${id}`);

    res.json({
      success: true,
      data: fraudAction,
    });
  } catch (error) {
    logger.error(
      `[FraudController] Error getting fraud action detail: ${error.message}`
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * POST /admin/fraud/actions/:id/release
 * Release a fraud action (make it inactive)
 *
 * Body:
 * {
 *   reason: "Why are you releasing this?"
 * }
 */
async function releaseFraudAction(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.admin._id;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Release reason is required",
      });
    }

    const fraudAction = await FraudAction.findById(id);

    if (!fraudAction) {
      return res.status(404).json({
        success: false,
        error: "Fraud action not found",
      });
    }

    if (
      fraudAction.status !== "active" &&
      fraudAction.status !== "converted_permanent"
    ) {
      return res.status(400).json({
        success: false,
        error: `Cannot release a ${fraudAction.status} action`,
      });
    }

    await fraudAction.release({
      releasedBy: adminId,
      reason,
      actorRole: "admin",
      ip: req.ip,
    });

    logger.info(
      `[FraudController] Admin ${adminId} released fraud action ${id}: "${reason}"`
    );

    res.json({
      success: true,
      message: "Fraud action released",
      data: fraudAction,
    });
  } catch (error) {
    logger.error(
      `[FraudController] Error releasing fraud action: ${error.message}`
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * POST /admin/fraud/actions/:id/extend
 * Extend a fraud action's expiry time
 *
 * Body:
 * {
 *   durationHours: 24,
 *   reason: "Why extend?"
 * }
 */
async function extendFraudAction(req, res) {
  try {
    const { id } = req.params;
    const { durationHours, reason } = req.body;
    const adminId = req.admin._id;

    if (!durationHours || durationHours <= 0) {
      return res.status(400).json({
        success: false,
        error: "Duration must be a positive number of hours",
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Extension reason is required",
      });
    }

    const fraudAction = await FraudAction.findById(id);

    if (!fraudAction) {
      return res.status(404).json({
        success: false,
        error: "Fraud action not found",
      });
    }

    if (fraudAction.status !== "active") {
      return res.status(400).json({
        success: false,
        error: `Cannot extend a ${fraudAction.status} action`,
      });
    }

    await fraudAction.extend({
      durationHours,
      extendedBy: adminId,
      reason,
      actorRole: "admin",
    });

    logger.warn(
      `[FraudController] Admin ${adminId} extended fraud action ${id} by ${durationHours}h: "${reason}"`
    );

    res.json({
      success: true,
      message: `Fraud action extended by ${durationHours} hours`,
      data: fraudAction,
    });
  } catch (error) {
    logger.error(
      `[FraudController] Error extending fraud action: ${error.message}`
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * POST /admin/fraud/actions/:id/convert-permanent
 * Convert a temporary fraud action to permanent
 *
 * Body:
 * {
 *   reason: "Why make it permanent?",
 *   justification: "Additional context"
 * }
 */
async function convertFraudActionToPermanent(req, res) {
  try {
    const { id } = req.params;
    const { reason, justification } = req.body;
    const adminId = req.admin._id;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Reason is required",
      });
    }

    const fraudAction = await FraudAction.findById(id);

    if (!fraudAction) {
      return res.status(404).json({
        success: false,
        error: "Fraud action not found",
      });
    }

    if (fraudAction.status !== "active") {
      return res.status(400).json({
        success: false,
        error: `Cannot convert a ${fraudAction.status} action to permanent`,
      });
    }

    await fraudAction.convertToPermanent({
      convertedBy: adminId,
      reason,
      justification,
      actorRole: "admin",
    });

    logger.warn(
      `[FraudController] Admin ${adminId} converted fraud action ${id} to PERMANENT: "${reason}"`
    );

    res.json({
      success: true,
      message: "Fraud action converted to permanent",
      data: fraudAction,
    });
  } catch (error) {
    logger.error(
      `[FraudController] Error converting fraud action: ${error.message}`
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * POST /admin/fraud/actions
 * Create a manual fraud action (admin can block directly)
 *
 * Body:
 * {
 *   type: "gift_block",
 *   targetType: "user",
 *   targetRef: "userId",
 *   durationHours: 24,
 *   reason: "Suspicious activity"
 * }
 */
async function createManualFraudAction(req, res) {
  try {
    const { type, targetType, targetRef, durationHours, reason } = req.body;
    const adminId = req.admin._id;

    // Validation
    const validTypes = [
      "gift_block",
      "wallet_freeze",
      "withdrawal_block",
      "host_suspend",
      "device_ban",
    ];

    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    const validTargetTypes = ["user", "host", "wallet", "device"];
    if (!targetType || !validTargetTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid targetType. Must be one of: ${validTargetTypes.join(
          ", "
        )}`,
      });
    }

    if (!targetRef) {
      return res.status(400).json({
        success: false,
        error: "targetRef is required",
      });
    }

    if (durationHours === undefined || durationHours === null) {
      return res.status(400).json({
        success: false,
        error: "durationHours is required (use 0 for no expiry)",
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Reason is required",
      });
    }

    // Check for existing active action
    const existingAction = await FraudAction.findOne({
      targetType,
      targetRef,
      type,
      status: "active",
      isDeleted: false,
    });

    if (existingAction) {
      return res.status(409).json({
        success: false,
        error: "An active fraud action already exists for this target",
      });
    }

    // Create action
    const expiresAt =
      durationHours > 0
        ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
        : null;

    const fraudAction = new FraudAction({
      type,
      targetType,
      targetRef,
      status: "active",
      expiresAt,
      durationHours,
      reason,
      isManuallyCreated: true,
      auditTrail: [
        {
          action: "created",
          timestamp: new Date(),
          actor: adminId,
          actorRole: "admin",
          reason: "Manual admin action",
        },
      ],
    });

    await fraudAction.save();

    logger.warn(
      `[FraudController] Admin ${adminId} manually created fraud action: ${type} for ${targetType}:${targetRef}`
    );

    res.status(201).json({
      success: true,
      message: "Fraud action created",
      data: fraudAction,
    });
  } catch (error) {
    logger.error(
      `[FraudController] Error creating fraud action: ${error.message}`
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * GET /admin/fraud/stats
 * Get fraud statistics
 */
async function getFraudStats(req, res) {
  try {
    const stats = await fraudEngine.getFraudStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error(
      `[FraudController] Error getting fraud stats: ${error.message}`
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * GET /admin/fraud/target/:targetType/:targetRef
 * Get all fraud actions for a specific target
 */
async function getTargetFraudActions(req, res) {
  try {
    const { targetType, targetRef } = req.params;

    const validTargetTypes = ["user", "host", "wallet", "device"];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid targetType. Must be one of: ${validTargetTypes.join(
          ", "
        )}`,
      });
    }

    const actions = await fraudEngine.getActiveFraudActions(
      targetType,
      targetRef
    );

    res.json({
      success: true,
      data: actions,
    });
  } catch (error) {
    logger.error(
      `[FraudController] Error getting target fraud actions: ${error.message}`
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  // List and view
  listFraudActions,
  getFraudActionDetail,
  getTargetFraudActions,
  getFraudStats,

  // Management
  releaseFraudAction,
  extendFraudAction,
  convertFraudActionToPermanent,

  // Manual creation
  createManualFraudAction,
};
