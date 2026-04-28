const models = require("../models");
const Alert = models.Alert;
const logger = console; // Replace with actual logger

/**
 * Alert Controller - Admin APIs for managing alerts
 */

// ============================================================================
// LIST ALERTS
// ============================================================================

/**
 * GET /admin/alerts
 * List all alerts with filtering
 */
async function listAlerts(req, res) {
  try {
    const {
      status = "open", // open | acknowledged | resolved
      type,
      severity,
      referenceType,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    // Build filter
    const filter = {};
    if (status !== "all") filter.status = status;
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (referenceType) filter.referenceType = referenceType;

    // Count total
    const total = await Alert.countDocuments(filter);

    // Fetch with pagination
    const alerts = await Alert.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          current: page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        summary: {
          byStatus: await Alert.aggregate([
            { $match: { status: { $exists: true } } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ]),
          bySeverity: await Alert.aggregate([
            { $match: filter },
            { $group: { _id: "$severity", count: { $sum: 1 } } },
          ]),
          byType: await Alert.aggregate([
            { $match: filter },
            { $group: { _id: "$type", count: { $sum: 1 } } },
          ]),
        },
      },
    });
  } catch (err) {
    logger.error("Error listing alerts:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================================
// GET SINGLE ALERT
// ============================================================================

/**
 * GET /admin/alerts/:id
 * Get alert details
 */
async function getAlert(req, res) {
  try {
    const alert = await Alert.findById(req.params.id).lean();

    if (!alert) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }

    res.json({ success: true, data: alert });
  } catch (err) {
    logger.error("Error getting alert:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================================
// ACKNOWLEDGE ALERT
// ============================================================================

/**
 * PATCH /admin/alerts/:id/acknowledge
 * Mark alert as acknowledged (admin reviewed it)
 */
async function acknowledgeAlert(req, res) {
  try {
    const { note } = req.body;
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }

    if (alert.status === "resolved") {
      return res.status(400).json({
        success: false,
        error: "Cannot acknowledge resolved alert",
      });
    }

    // Update alert
    alert.status = "acknowledged";
    alert.acknowledgedBy = req.user._id; // From auth middleware
    alert.acknowledgedAt = new Date();

    // Add to audit log
    alert.auditLog.push({
      action: "acknowledged",
      by: req.user._id,
      timestamp: new Date(),
      note: note || "Alert reviewed",
    });

    await alert.save();

    logger.info(`Alert ${alert._id} acknowledged by ${req.user._id}`);

    res.json({ success: true, data: alert });
  } catch (err) {
    logger.error("Error acknowledging alert:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================================
// RESOLVE ALERT
// ============================================================================

/**
 * PATCH /admin/alerts/:id/resolve
 * Mark alert as resolved (issue fixed/investigated)
 */
async function resolveAlert(req, res) {
  try {
    const { note, actions = [] } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        error: "Resolution note is required",
      });
    }

    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }

    // Update alert
    alert.status = "resolved";
    alert.resolvedBy = req.user._id;
    alert.resolvedAt = new Date();
    alert.resolutionNote = note;

    // Add to audit log
    alert.auditLog.push({
      action: "resolved",
      by: req.user._id,
      timestamp: new Date(),
      note: `Resolved: ${note}. Actions: ${actions.join(", ") || "none"}`,
    });

    await alert.save();

    logger.info(
      `Alert ${alert._id} resolved by ${req.user._id}. Note: ${note}`
    );

    res.json({ success: true, data: alert });
  } catch (err) {
    logger.error("Error resolving alert:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * PATCH /admin/alerts/bulk/acknowledge
 * Acknowledge multiple alerts
 */
async function acknowledgeMultiple(req, res) {
  try {
    const { alertIds, note } = req.body;

    if (!alertIds || !Array.isArray(alertIds)) {
      return res.status(400).json({
        success: false,
        error: "alertIds array is required",
      });
    }

    const result = await Alert.updateMany(
      { _id: { $in: alertIds }, status: { $ne: "resolved" } },
      {
        $set: {
          status: "acknowledged",
          acknowledgedBy: req.user._id,
          acknowledgedAt: new Date(),
        },
        $push: {
          auditLog: {
            action: "acknowledged",
            by: req.user._id,
            timestamp: new Date(),
            note: note || "Bulk acknowledged",
          },
        },
      }
    );

    logger.info(
      `${result.modifiedCount} alerts acknowledged by ${req.user._id}`
    );

    res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (err) {
    logger.error("Error acknowledging multiple alerts:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /admin/alerts/bulk/delete
 * Delete resolved/old alerts
 */
async function deleteAlerts(req, res) {
  try {
    const { status = "resolved", daysOld = 7 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const filter = {
      status,
      createdAt: { $lt: cutoffDate },
    };

    const result = await Alert.deleteMany(filter);

    logger.info(
      `Deleted ${result.deletedCount} ${status} alerts older than ${daysOld} days`
    );

    res.json({
      success: true,
      data: { deletedCount: result.deletedCount },
    });
  } catch (err) {
    logger.error("Error deleting alerts:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================================
// ALERT STATISTICS
// ============================================================================

/**
 * GET /admin/alerts/stats/summary
 * Get alert summary statistics
 */
async function getAlertStats(req, res) {
  try {
    const stats = {
      total: await Alert.countDocuments(),
      byStatus: await Alert.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      bySeverity: await Alert.aggregate([
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
      byType: await Alert.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      byCritical: {
        count: await Alert.countDocuments({
          status: "open",
          severity: "critical",
        }),
        types: await Alert.aggregate([
          { $match: { status: "open", severity: "critical" } },
          { $group: { _id: "$type", count: { $sum: 1 } } },
        ]),
      },
      averageResolutionTime: await Alert.aggregate([
        {
          $match: { resolvedAt: { $exists: true } },
        },
        {
          $group: {
            _id: null,
            avgHours: {
              $avg: {
                $divide: [
                  { $subtract: ["$resolvedAt", "$createdAt"] },
                  3600000,
                ],
              },
            },
          },
        },
      ]),
      openAlertsOverTime: await Alert.aggregate([
        {
          $match: { status: "open" },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error("Error getting alert stats:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================================
// GET ALERTS FOR ENTITY
// ============================================================================

/**
 * GET /admin/alerts/entity/:referenceType/:referenceId
 * Get all alerts for a specific entity (host, agency, user, etc.)
 */
async function getEntityAlerts(req, res) {
  try {
    const { referenceType, referenceId } = req.params;

    const alerts = await Alert.find({
      referenceType,
      referenceId,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        entity: { referenceType, referenceId },
        alerts,
        stats: {
          total: alerts.length,
          open: alerts.filter((a) => a.status === "open").length,
          critical: alerts.filter((a) => a.severity === "critical").length,
        },
      },
    });
  } catch (err) {
    logger.error("Error getting entity alerts:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  listAlerts,
  getAlert,
  acknowledgeAlert,
  resolveAlert,
  acknowledgeMultiple,
  deleteAlerts,
  getAlertStats,
  getEntityAlerts,
};
