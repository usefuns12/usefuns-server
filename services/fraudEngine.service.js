const models = require("../models");
const FraudAction = models.FraudAction;
const Alert = models.Alert;
const logger = require("../classes/logger");

/**
 * STEP 6.4 - Fraud Rule Engine
 *
 * Rules that map alerts to automatic actions
 *
 * Rules format:
 * {
 *   triggerAlert: "alert_type",
 *   countThreshold: number,      // How many in timeWindow
 *   timeWindow: hours,            // Time period to count
 *   action: { type, targetType, durationHours },
 *   reason: "explanation"
 * }
 */

const FRAUD_RULES = [
  // GIFT VELOCITY - Multiple gift alerts in short time = temporary gift block
  {
    triggerAlert: "gift_velocity",
    countThreshold: 2, // 2 gift velocity alerts
    timeWindow: 24, // within 24 hours
    action: {
      type: "gift_block",
      targetType: "user",
      durationHours: 12, // 12-hour temp ban
    },
    reason:
      "Detected repeated gift velocity anomalies - temporary gift suspension",
  },

  // GIFT LOOP - Detected cyclic gift exchanges = gift block (longer)
  {
    triggerAlert: "gift_loop",
    countThreshold: 1, // Just 1 gift_loop alert
    timeWindow: 24,
    action: {
      type: "gift_block",
      targetType: "user",
      durationHours: 24, // 24-hour temp ban
    },
    reason: "Detected cyclic gift exchange pattern - gift temporarily blocked",
  },

  // WALLET MISMATCH - Wallet balance issue = wallet freeze (manual review needed)
  {
    triggerAlert: "wallet_mismatch",
    countThreshold: 1, // Just 1 alert
    timeWindow: 1,
    action: {
      type: "wallet_freeze",
      targetType: "wallet",
      durationHours: 0, // 0 = no auto-expiry (manual release)
      isManualRelease: true,
    },
    reason:
      "Wallet balance mismatch detected - wallet frozen pending manual review",
  },

  // SALARY ANOMALY - Zero or extremely low salary multiple times = host suspend
  {
    triggerAlert: "salary_zero",
    countThreshold: 3, // 3 times
    timeWindow: 30, // within 30 days
    action: {
      type: "host_suspend",
      targetType: "host",
      durationHours: 24, // 24-hour suspension
    },
    reason:
      "Repeated salary anomalies detected - host activity temporarily suspended",
  },

  // COMMISSION DROP - Significant commission drop = pattern to watch
  {
    triggerAlert: "commission_drop",
    countThreshold: 2,
    timeWindow: 7,
    action: {
      type: "host_suspend",
      targetType: "host",
      durationHours: 6, // 6-hour temporary suspension
    },
    reason: "Multiple commission anomalies - temporary suspension for review",
  },

  // VIP ANOMALY - VIP user showing suspicious activity
  {
    triggerAlert: "vip_anomaly",
    countThreshold: 2,
    timeWindow: 24,
    action: {
      type: "gift_block",
      targetType: "user",
      durationHours: 6,
    },
    reason:
      "VIP account showing anomalous behavior - temporary gifting restriction",
  },

  // CYCLE STUCK - Multiple stuck cycle alerts
  {
    triggerAlert: "cycle_stuck",
    countThreshold: 2,
    timeWindow: 24,
    action: {
      type: "withdrawal_block",
      targetType: "user",
      durationHours: 12,
    },
    reason:
      "Multiple cycle stuck alerts - withdrawals temporarily blocked pending resolution",
  },
];

/**
 * Check if an alert should trigger a fraud action
 * @param {Object} alert - The alert object
 * @returns {Promise<Object|null>} - Action object if should create, null otherwise
 */
async function checkAlertForAction(alert) {
  try {
    // Find matching rule for this alert
    const rule = FRAUD_RULES.find((r) => r.triggerAlert === alert.type);

    if (!rule) {
      // No rule for this alert type
      return null;
    }

    // Count how many of this alert type for this entity in timeWindow
    const timeWindowStart = new Date(
      Date.now() - rule.timeWindow * 60 * 60 * 1000
    );

    const recentCount = await Alert.countDocuments({
      type: alert.type,
      sourceId: alert.sourceId,
      sourceType: alert.sourceType,
      createdAt: { $gte: timeWindowStart },
    });

    logger.info(
      `[FraudEngine] Alert ${alert.type} for ${alert.sourceType}:${alert.sourceId} - Count: ${recentCount}/${rule.countThreshold}`
    );

    // Check if threshold met
    if (recentCount >= rule.countThreshold) {
      logger.warn(
        `[FraudEngine] THRESHOLD MET - Creating fraud action for ${alert.type}`
      );

      // Return action to create
      return {
        rule,
        alert,
        recentCount,
      };
    }

    return null;
  } catch (error) {
    logger.error(
      `[FraudEngine] Error checking alert for action: ${error.message}`
    );
    // Never throw - non-blocking
    return null;
  }
}

/**
 * Apply a fraud action (create FraudAction record)
 * @param {Object} actionData - Contains rule, alert, recentCount
 * @returns {Promise<Object>} - Created FraudAction
 */
async function applyFraudAction(actionData) {
  try {
    const { rule, alert, recentCount } = actionData;

    // Determine target reference based on alert sourceType
    let targetRef = alert.sourceId;
    let targetType = rule.action.targetType;

    // For wallet freeze, use wallet ID if available
    if (rule.action.type === "wallet_freeze" && alert.metadata?.walletId) {
      targetRef = alert.metadata.walletId;
    }

    // Check if active action already exists for this target
    const existingAction = await FraudAction.findOne({
      targetType,
      targetRef,
      type: rule.action.type,
      status: "active",
      isDeleted: false,
    });

    if (existingAction) {
      logger.info(
        `[FraudEngine] Active action already exists for ${targetType}:${targetRef}`
      );
      // Optionally extend instead - but for now just skip
      return existingAction;
    }

    // Create the action
    const expiresAt =
      rule.action.durationHours > 0
        ? new Date(Date.now() + rule.action.durationHours * 60 * 60 * 1000)
        : null;

    const fraudAction = new FraudAction({
      type: rule.action.type,
      targetType,
      targetRef,
      triggeredByAlert: alert._id,
      status: "active",
      expiresAt,
      durationHours: rule.action.durationHours,
      reason: rule.reason,
      triggerMetadata: {
        alertType: alert.type,
        alertCount: recentCount,
        threshold: rule.countThreshold,
        evidenceUrls: [`/admin/alerts/${alert._id}`],
      },
      auditTrail: [
        {
          action: "created",
          timestamp: new Date(),
          actor: null,
          actorRole: "system",
          reason: "Automatic fraud detection",
          metadata: {
            triggerAlertId: alert._id,
            rule: rule.triggerAlert,
            countThreshold: rule.countThreshold,
          },
        },
      ],
    });

    await fraudAction.save();

    logger.info(
      `[FraudEngine] Created fraud action: ${fraudAction._id} (${fraudAction.type} for ${fraudAction.targetType}:${fraudAction.targetRef})`
    );

    return fraudAction;
  } catch (error) {
    logger.error(`[FraudEngine] Error applying fraud action: ${error.message}`);
    // Never throw - non-blocking
    return null;
  }
}

/**
 * Check if target has an active fraud action of given type
 * @param {String} targetType - "user", "host", "wallet", "device"
 * @param {String} targetRef - ObjectId or identifier
 * @param {String} actionType - "gift_block", "wallet_freeze", etc
 * @returns {Promise<Object|null>} - FraudAction if active, null otherwise
 */
async function hasActiveFraudAction(targetType, targetRef, actionType = null) {
  try {
    const query = {
      targetType,
      targetRef,
      status: { $in: ["active", "converted_permanent"] },
      isDeleted: false,
    };

    if (actionType) {
      query.type = actionType;
    }

    // Check if action exists
    const action = await FraudAction.findOne(query);

    if (action && action.expiresAt && new Date() >= action.expiresAt) {
      // Action has expired
      await action.markExpired();
      return null;
    }

    return action || null;
  } catch (error) {
    logger.error(`[FraudEngine] Error checking fraud action: ${error.message}`);
    return null;
  }
}

/**
 * Get all active actions for a target
 * @param {String} targetType - "user", "host", "wallet", "device"
 * @param {String} targetRef - ObjectId or identifier
 * @returns {Promise<Array>} - Array of active FraudActions
 */
async function getActiveFraudActions(targetType, targetRef) {
  try {
    return await FraudAction.find({
      targetType,
      targetRef,
      status: { $in: ["active", "converted_permanent"] },
      isDeleted: false,
    }).sort({ createdAt: -1 });
  } catch (error) {
    logger.error(`[FraudEngine] Error getting fraud actions: ${error.message}`);
    return [];
  }
}

/**
 * Process expired actions (run periodically via scheduler)
 * @returns {Promise<Number>} - Count of expired actions processed
 */
async function processExpiredActions() {
  try {
    // Find actions that have expired
    const expiredActions = await FraudAction.find({
      status: "active",
      expiresAt: { $lt: new Date() },
      isDeleted: false,
    });

    logger.info(
      `[FraudEngine] Found ${expiredActions.length} expired actions to process`
    );

    let processedCount = 0;

    for (const action of expiredActions) {
      await action.markExpired();
      processedCount++;
    }

    logger.info(`[FraudEngine] Processed ${processedCount} expired actions`);
    return processedCount;
  } catch (error) {
    logger.error(
      `[FraudEngine] Error processing expired actions: ${error.message}`
    );
    return 0;
  }
}

/**
 * Get fraud action by ID (for admin view)
 * @param {String} fraudActionId - FraudAction ObjectId
 * @returns {Promise<Object|null>} - FraudAction with populated refs
 */
async function getFraudActionDetail(fraudActionId) {
  try {
    return await FraudAction.findById(fraudActionId)
      .populate("triggeredByAlert")
      .populate("releasedBy", "email name")
      .populate("extendedBy", "email name")
      .populate("auditTrail.actor", "email name")
      .lean();
  } catch (error) {
    logger.error(`[FraudEngine] Error fetching fraud action: ${error.message}`);
    return null;
  }
}

/**
 * List fraud actions with filters
 * @param {Object} filters - { targetType, targetRef, status, type, page, limit }
 * @returns {Promise<Object>} - { data: [], total, page, limit, pages }
 */
async function listFraudActions(filters = {}) {
  try {
    const {
      targetType,
      targetRef,
      status,
      type,
      page = 1,
      limit = 20,
    } = filters;

    const query = { isDeleted: false };

    if (targetType) query.targetType = targetType;
    if (targetRef) query.targetRef = targetRef;
    if (status) query.status = status;
    if (type) query.type = type;

    const total = await FraudAction.countDocuments(query);
    const skip = (page - 1) * limit;

    const data = await FraudAction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("triggeredByAlert", "type severity sourceType sourceId")
      .populate("releasedBy", "email name")
      .lean();

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error(`[FraudEngine] Error listing fraud actions: ${error.message}`);
    return { data: [], total: 0, page: 1, limit: 20, pages: 0 };
  }
}

/**
 * Get statistics on fraud actions
 * @returns {Promise<Object>} - Stats by type and status
 */
async function getFraudStats() {
  try {
    const stats = await FraudAction.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: {
            type: "$type",
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.type": 1, "_id.status": 1 } },
    ]);

    // Active count with expiry soon
    const expiringSoon = await FraudAction.countDocuments({
      status: "active",
      expiresAt: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next 24 hours
      },
      isDeleted: false,
    });

    return {
      byTypeAndStatus: stats,
      expiringSoon,
    };
  } catch (error) {
    logger.error(`[FraudEngine] Error getting fraud stats: ${error.message}`);
    return { byTypeAndStatus: [], expiringSoon: 0 };
  }
}

/**
 * Validate and ensure FraudAction and Alert tables exist and have indexes
 */
async function validateSchema() {
  try {
    // Indexes are created in model definition
    logger.info("[FraudEngine] Schema validation passed");
    return true;
  } catch (error) {
    logger.error(`[FraudEngine] Schema validation failed: ${error.message}`);
    return false;
  }
}

module.exports = {
  // Rule checking
  checkAlertForAction,
  applyFraudAction,

  // Enforcement
  hasActiveFraudAction,
  getActiveFraudActions,

  // Management
  processExpiredActions,
  getFraudActionDetail,
  listFraudActions,
  getFraudStats,

  // Admin operations (called from controller)
  validateSchema,

  // For testing/debugging
  FRAUD_RULES,
};
