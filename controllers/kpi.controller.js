const models = require("../models");
const Host = models.Host;
const Agency = models.Agency;
const User = models.User;
const Wallet = models.Wallet;
const Transaction = models.Transaction;
const HostSalaryCycle = models.HostSalaryCycle;
const AgencyCommissionCycle = models.AgencyCommissionCycle;
const GiftTransaction = models.GiftTransaction;
const Alert = models.Alert;
const Dispute = models.Dispute;

const logger = console; // Replace with actual logger

/**
 * KPI Controller - Read-only dashboards for monitoring
 * Shows health metrics without modification ability
 */

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================

/**
 * GET /admin/kpi/dashboard
 * High-level overview for operation team
 */
async function getDashboardSummary(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const dashboard = {
      activeUsers: await User.countDocuments({
        isActive: true,
        deletedAt: null,
      }),
      activeHosts: await Host.countDocuments({
        isActive: true,
        deletedAt: null,
      }),
      activeAgencies: await Agency.countDocuments({
        isActive: true,
        deletedAt: null,
      }),

      // Financial Metrics
      financials: {
        totalPaidToday: await HostSalaryCycle.aggregate([
          {
            $match: {
              createdAt: { $gte: today },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$salaryUcoins" },
            },
          },
        ]).then((r) => (r.length > 0 ? r[0].total : 0)),

        totalLocked: await Wallet.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: "$lockedUcoins" },
            },
          },
        ]).then((r) => (r.length > 0 ? r[0].total : 0)),

        totalWithdrawable: await Wallet.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: "$withdrawableUcoins" },
            },
          },
        ]).then((r) => (r.length > 0 ? r[0].total : 0)),

        totalPaidLast7Days: await HostSalaryCycle.aggregate([
          {
            $match: {
              createdAt: { $gte: last7Days },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$salaryUcoins" },
            },
          },
        ]).then((r) => (r.length > 0 ? r[0].total : 0)),

        totalPaidLast30Days: await HostSalaryCycle.aggregate([
          {
            $match: {
              createdAt: { $gte: last30Days },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$salaryUcoins" },
            },
          },
        ]).then((r) => (r.length > 0 ? r[0].total : 0)),
      },

      // Alert Metrics
      alerts: {
        open: await Alert.countDocuments({ status: "open" }),
        critical: await Alert.countDocuments({
          status: "open",
          severity: "critical",
        }),
        byType: await Alert.aggregate([
          { $match: { status: "open" } },
          { $group: { _id: "$type", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        last24h: await Alert.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
      },

      // Dispute Metrics
      disputes: {
        open: await Dispute.countDocuments({ status: "open" }),
        pending: await Dispute.countDocuments({ status: "under_review" }),
        resolved: await Dispute.countDocuments({
          status: "resolved",
          updatedAt: { $gte: last7Days },
        }),
        avgResolutionHours:
          (await Dispute.aggregate([
            {
              $match: { status: "resolved" },
            },
            {
              $group: {
                _id: null,
                avg: {
                  $avg: {
                    $divide: [
                      { $subtract: ["$resolution.resolvedAt", "$createdAt"] },
                      3600000,
                    ],
                  },
                },
              },
            },
          ])[0]) || 0,
      },

      // Gift Metrics
      gifts: {
        totalToday: await GiftTransaction.countDocuments({
          createdAt: { $gte: today },
        }),
        totalDiamondsToday: await GiftTransaction.aggregate([
          {
            $match: { createdAt: { $gte: today } },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$totalDiamonds" },
            },
          },
        ]).then((r) => (r.length > 0 ? r[0].total : 0)),

        totalLast7Days: await GiftTransaction.countDocuments({
          createdAt: { $gte: last7Days },
        }),
      },

      timestamp: new Date(),
    };

    res.json({ success: true, data: dashboard });
  } catch (err) {
    logger.error("Error getting dashboard summary:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================================
// WALLET HEALTH
// ============================================================================

/**
 * GET /admin/kpi/wallets
 * Wallet health metrics
 */
async function getWalletHealth(req, res) {
  try {
    const stats = {
      byStatus: await Wallet.aggregate([
        {
          $facet: {
            totalUcoins: [
              {
                $group: {
                  _id: null,
                  amount: { $sum: "$totalUcoins" },
                },
              },
            ],
            lockedUcoins: [
              {
                $group: {
                  _id: null,
                  amount: { $sum: "$lockedUcoins" },
                },
              },
            ],
            withdrawableUcoins: [
              {
                $group: {
                  _id: null,
                  amount: { $sum: "$withdrawableUcoins" },
                },
              },
            ],
            mismatches: [
              {
                $project: {
                  expected: { $add: ["$lockedUcoins", "$withdrawableUcoins"] },
                  actual: "$totalUcoins",
                  isMismatch: {
                    $ne: [
                      { $add: ["$lockedUcoins", "$withdrawableUcoins"] },
                      "$totalUcoins",
                    ],
                  },
                },
              },
              {
                $match: { isMismatch: true },
              },
              {
                $count: "count",
              },
            ],
          },
        },
      ]),

      // Wallets with negative balance (problem)
      negativeBalance: await Wallet.countDocuments({ totalUcoins: { $lt: 0 } }),

      // High risk: locked > threshold
      highLocked: await Wallet.countDocuments({
        lockedUcoins: { $gt: 10000 },
      }),

      // Distribution
      distribution: await Wallet.aggregate([
        {
          $bucket: {
            groupBy: "$withdrawableUcoins",
            boundaries: [0, 100, 500, 1000, 5000, 10000, 100000],
            default: "high",
            output: {
              count: { $sum: 1 },
            },
          },
        },
      ]),
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error("Error getting wallet health:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================================
// SALARY CYCLE HEALTH
// ============================================================================

/**
 * GET /admin/kpi/salary-cycles
 * Salary cycle status and anomalies
 */
async function getSalaryCycleHealth(req, res) {
  try {
    const stats = {
      // By status
      byStatus: await HostSalaryCycle.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalPaid: { $sum: "$salaryUcoins" },
          },
        },
      ]),

      // Cycles with 0 salary (problem)
      zeroSalary: await HostSalaryCycle.countDocuments({ salaryUcoins: 0 }),

      // Recent cycles
      recentCycles: await HostSalaryCycle.aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 100 },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
            totalPaid: { $sum: "$salaryUcoins" },
            avgSalary: { $avg: "$salaryUcoins" },
          },
        },
        { $sort: { _id: -1 } },
      ]),

      // Stuck cycles (pending > 24h)
      stuckCycles: await HostSalaryCycle.countDocuments({
        status: "pending",
        createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error("Error getting salary cycle health:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================================
// GIFT ANOMALY DETECTION KPI
// ============================================================================

/**
 * GET /admin/kpi/gift-anomalies
 * Gift velocity and loop detection metrics
 */
async function getGiftAnomalies(req, res) {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [highVolumeSenders, giftLoops, highVolumReceivers, trend] =
      await Promise.all([
        GiftTransaction.aggregate([
          {
            $match: { createdAt: { $gte: last24h } },
          },
          {
            $group: {
              _id: "$sender",
              count: { $sum: 1 },
              diamonds: { $sum: "$totalDiamonds" },
            },
          },
          {
            $match: { count: { $gte: 10 } },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: 10,
          },
        ]),
        GiftTransaction.aggregate([
          {
            $group: {
              _id: {
                sender: "$sender",
                receiver: "$receiver",
              },
              count: { $sum: 1 },
              diamonds: { $sum: "$totalDiamonds" },
            },
          },
          {
            $match: { count: { $gte: 5 } },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: 20,
          },
        ]),
        GiftTransaction.aggregate([
          {
            $match: { createdAt: { $gte: last24h } },
          },
          {
            $group: {
              _id: "$receiver",
              count: { $sum: 1 },
              totalDiamonds: { $sum: "$totalDiamonds" },
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: 10,
          },
        ]),
        GiftTransaction.aggregate([
          {
            $match: { createdAt: { $gte: last7Days } },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
              diamonds: { $sum: "$totalDiamonds" },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]),
      ]);

    const customerIds = [
      ...new Set(
        [
          ...highVolumeSenders.map((entry) => entry._id),
          ...giftLoops.flatMap((entry) => [
            entry._id?.sender,
            entry._id?.receiver,
          ]),
          ...highVolumReceivers.map((entry) => entry._id),
        ]
          .filter(Boolean)
          .map((value) => String(value)),
      ),
    ];

    const customers = await models.Customer.find({ _id: { $in: customerIds } })
      .select("name userId")
      .lean();

    const customerMap = new Map(
      customers.map((customer) => [String(customer._id), customer]),
    );

    const getCustomerLabel = (customerId) => {
      const customer = customerMap.get(String(customerId));
      if (!customer) return String(customerId || "-");
      return customer.name
        ? `${customer.name} (${customer._id})`
        : customer.userId || String(customer._id);
    };

    const stats = {
      highVolumeSenders: highVolumeSenders.map((entry) => ({
        ...entry,
        senderName: getCustomerLabel(entry._id),
      })),
      giftLoops: giftLoops.map((entry) => ({
        ...entry,
        senderName: getCustomerLabel(entry._id?.sender),
        receiverName: getCustomerLabel(entry._id?.receiver),
        patternLabel: `${getCustomerLabel(entry._id?.sender)} -> ${getCustomerLabel(entry._id?.receiver)}`,
      })),
      highVolumReceivers: highVolumReceivers.map((entry) => ({
        ...entry,
        receiverName: getCustomerLabel(entry._id),
      })),
      trend,
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error("Error getting gift anomalies:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================================
// SYSTEM HEALTH
// ============================================================================

/**
 * GET /admin/kpi/system-health
 * Overall system health indicators
 */
async function getSystemHealth(req, res) {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const health = {
      // Database connectivity
      dbStatus: "healthy", // Would check with ping

      // Cron jobs
      cronHealth: {
        failedLast24h: await Alert.countDocuments({
          type: { $in: ["cron_failure", "unlock_failure"] },
          createdAt: { $gte: last24h },
        }),
        failedLast7Days: await Alert.countDocuments({
          type: { $in: ["cron_failure", "unlock_failure"] },
          createdAt: { $gte: last7Days },
        }),
      },

      // Stuck cycles
      stuckCycles: {
        total: await HostSalaryCycle.countDocuments({
          status: "pending",
          createdAt: { $lt: new Date(Date.now() - 12 * 60 * 60 * 1000) },
        }),
      },

      // Wallet mismatches
      walletMismatches: {
        total: await Alert.countDocuments({
          type: "wallet_mismatch",
          status: "open",
        }),
      },

      // Recent critical issues
      criticalAlerts: {
        last24h: await Alert.countDocuments({
          severity: "critical",
          createdAt: { $gte: last24h },
        }),
        unresolved: await Alert.countDocuments({
          severity: "critical",
          status: { $ne: "resolved" },
        }),
      },

      // Overall health score (0-100)
      healthScore: await calculateHealthScore(),
    };

    res.json({ success: true, data: health });
  } catch (err) {
    logger.error("Error getting system health:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Calculate overall health score (0-100)
 */
async function calculateHealthScore() {
  let score = 100;

  // Deduct for critical open alerts
  const criticalAlerts = await Alert.countDocuments({
    severity: "critical",
    status: "open",
  });
  score -= Math.min(criticalAlerts * 5, 30);

  // Deduct for stuck cycles
  const stuckCycles = await HostSalaryCycle.countDocuments({
    status: "pending",
    createdAt: { $lt: new Date(Date.now() - 12 * 60 * 60 * 1000) },
  });
  score -= Math.min(stuckCycles * 2, 20);

  // Deduct for wallet mismatches
  const walletMismatches = await Alert.countDocuments({
    type: "wallet_mismatch",
    status: "open",
  });
  score -= Math.min(walletMismatches * 3, 25);

  // Deduct for unresolved disputes
  const openDisputes = await Dispute.countDocuments({ status: "open" });
  score -= Math.min(openDisputes * 1, 15);

  return Math.max(score, 0);
}

module.exports = {
  getDashboardSummary,
  getWalletHealth,
  getSalaryCycleHealth,
  getGiftAnomalies,
  getSystemHealth,
  calculateHealthScore,
};
