const models = require("../models");
const Alert = models.Alert;
const Host = models.Host;
const Agency = models.Agency;
const User = models.User;
const Customer = models.Customer;
const HostSalaryCycle = models.HostSalaryCycle;
const logger = console; // Replace with actual logger

function formatNameId(name, id) {
  const cleanName = String(name || "").trim();
  const cleanId = String(id || "").trim();
  if (cleanName && cleanId) return `${cleanName} (${cleanId})`;
  return cleanName || cleanId || "N/A";
}

async function getCustomerLabel(customerId) {
  if (!customerId) return "N/A";
  const customer = await Customer.findById(customerId)
    .select("name userId")
    .lean();
  if (!customer) return String(customerId);
  return formatNameId(customer.name || customer.userId, customer._id);
}

async function getCustomerName(customerId) {
  if (!customerId) return null;
  const customer = await Customer.findById(customerId)
    .select("name userId")
    .lean();
  return customer?.name || customer?.userId || null;
}

async function getHostLabel(hostId) {
  if (!hostId) return "N/A";
  const host = await Host.findById(hostId).select("hostId customerRef").lean();

  if (!host) return String(hostId);
  const hostName = await getCustomerName(host.customerRef);

  return formatNameId(hostName || host.hostId, host._id);
}

async function getAgencyLabel(agencyId) {
  if (!agencyId) return "N/A";
  const agency = await Agency.findById(agencyId).select("name agencyId").lean();
  if (!agency) return String(agencyId);
  return formatNameId(agency.name || agency.agencyId, agency._id);
}

async function getUserLabel(userId) {
  if (!userId) return "N/A";
  const user = await User.findById(userId).select("customerRef").lean();
  if (!user) return String(userId);
  return user.customerRef
    ? await getCustomerLabel(user.customerRef)
    : String(userId);
}

async function getCycleLabel(cycleId) {
  if (!cycleId) return "N/A";
  const cycle = await HostSalaryCycle.findById(cycleId).select("hostId").lean();
  if (!cycle) return String(cycleId);
  const hostName = await getHostName(cycle.hostId);
  return formatNameId(`Salary Cycle for ${hostName || "Host"}`, cycle._id);
}

async function getHostName(hostId) {
  if (!hostId) return null;
  const host = await Host.findById(hostId).select("hostId customerRef").lean();
  if (!host) return null;
  return (await getCustomerName(host.customerRef)) || host.hostId || null;
}

async function enrichAlert(alert) {
  const referenceResolvers = {
    host: () => getHostLabel(alert.referenceId),
    agency: () => getAgencyLabel(alert.referenceId),
    user: () => getUserLabel(alert.referenceId),
    cycle: () => getCycleLabel(alert.referenceId),
    wallet: () => Promise.resolve(formatNameId("Wallet", alert.referenceId)),
    cron: () => Promise.resolve(formatNameId("Cron", alert.referenceId)),
  };

  let referenceLabel = null;

  if (referenceResolvers[alert.referenceType]) {
    referenceLabel = await referenceResolvers[alert.referenceType]();
  }

  if (!referenceLabel || referenceLabel === String(alert.referenceId)) {
    if (alert.referenceType === "user") {
      referenceLabel = await getCustomerLabel(alert.referenceId);
    } else {
      referenceLabel = formatNameId(alert.referenceType, alert.referenceId);
    }
  }

  const acknowledgedByLabel = alert.acknowledgedBy
    ? await getUserLabel(alert.acknowledgedBy)
    : null;

  const resolvedByLabel = alert.resolvedBy
    ? await getUserLabel(alert.resolvedBy)
    : null;

  const messageTokens = new Map();
  const addToken = (value, label) => {
    if (!value || !label) return;
    messageTokens.set(String(value), String(label));
  };

  addToken(alert.referenceId, referenceLabel);
  if (alert.meta?.hostId) {
    addToken(alert.meta.hostId, await getHostLabel(alert.meta.hostId));
  }

  if (alert.meta?.senderId) {
    addToken(alert.meta.senderId, await getCustomerLabel(alert.meta.senderId));
  }
  if (alert.meta?.receiverId) {
    addToken(
      alert.meta.receiverId,
      await getCustomerLabel(alert.meta.receiverId),
    );
  }
  if (alert.meta?.userId) {
    addToken(alert.meta.userId, await getCustomerLabel(alert.meta.userId));
  }
  if (alert.meta?.cycleId) {
    addToken(alert.meta.cycleId, await getCycleLabel(alert.meta.cycleId));
  }
  if (alert.meta?.previousCycleId) {
    addToken(
      alert.meta.previousCycleId,
      await getCycleLabel(alert.meta.previousCycleId),
    );
  }
  if (alert.meta?.currentCycleId) {
    addToken(
      alert.meta.currentCycleId,
      await getCycleLabel(alert.meta.currentCycleId),
    );
  }

  const displayMessage =
    typeof alert.message === "string"
      ? Array.from(messageTokens.entries()).reduce(
          (text, [rawValue, label]) =>
            text.replace(
              new RegExp(rawValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
              label,
            ),
          alert.message,
        )
      : alert.message;

  return {
    ...alert,
    referenceLabel,
    acknowledgedByLabel,
    resolvedByLabel,
    displayMessage,
  };
}

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

    const enrichedAlerts = await Promise.all(alerts.map(enrichAlert));

    res.json({
      success: true,
      data: {
        alerts: enrichedAlerts,
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

    res.json({ success: true, data: await enrichAlert(alert) });
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
      `Alert ${alert._id} resolved by ${req.user._id}. Note: ${note}`,
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
      },
    );

    logger.info(
      `${result.modifiedCount} alerts acknowledged by ${req.user._id}`,
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
      `Deleted ${result.deletedCount} ${status} alerts older than ${daysOld} days`,
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
