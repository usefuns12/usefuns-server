/**
 * Queue Consumers
 * Job processors for all async tasks
 */

const queueService = require("./queue.service");
const { logger } = require("../classes/logger");

// Import services
const {
  processSalaryCycles,
  processSalaryForHost,
} = require("../controllers/salary.controller");
const { unlockWallet } = require("../controllers/wallet.controller");
const { performHealthCheck } = require("../controllers/health.controller");
const fraudEngine = require("./fraudEngine.service");
const alertService = require("./alert.service");
const metricsService = require("./metrics.service");

/**
 * SALARY CYCLE PROCESSOR
 * Processes salary/commission cycles for all hosts
 */
async function processSalaryCycleJob(job) {
  try {
    logger.info(`[SALARY CYCLE] Processing cycle for period:`, job.data);

    const { month, year } = job.data;

    // Get all active hosts
    const Host = require("../models/Host");
    const activeHosts = await Host.find({
      isActive: true,
      hasSalaryCycle: true,
    });

    let processedCount = 0;
    let failedCount = 0;
    const errors = [];

    // Process salary for each host
    for (const host of activeHosts) {
      try {
        await processSalaryForHost(host._id, { month, year });
        processedCount++;
      } catch (error) {
        failedCount++;
        errors.push({
          hostId: host._id,
          error: error.message,
        });
        logger.error(`Failed to process salary for host ${host._id}:`, error);
      }
    }

    const result = {
      month,
      year,
      processedCount,
      failedCount,
      errors: failedCount > 0 ? errors : undefined,
      totalHosts: activeHosts.length,
    };

    logger.info(`[SALARY CYCLE] Completed:`, result);

    // Track metrics
    metricsService.trackCronExecution(
      "salary_cycle_processor",
      job.finishedOn - job.processedOn,
      failedCount === 0
    );

    if (failedCount > 0) {
      // Alert if salary processing had failures
      await alertService.createAlert("salary_cycle_failed", "critical", {
        processedCount,
        failedCount,
        totalHosts: activeHosts.length,
        failures: errors,
      });
    }

    return result;
  } catch (error) {
    logger.error("[SALARY CYCLE] Job failed:", error);
    metricsService.trackError("salary_cycle_job_failed", error);
    throw error;
  }
}

/**
 * WALLET UNLOCK PROCESSOR
 * Unlocks wallets after lock duration expires
 */
async function walletUnlockJob(job) {
  try {
    const { walletId, lockId } = job.data;
    logger.info(`[WALLET UNLOCK] Attempting to unlock wallet ${walletId}`);

    const Wallet = require("../models/Wallet");
    const WalletLock = require("../models/WalletLock");

    // Get lock record
    const lock = await WalletLock.findById(lockId);
    if (!lock) {
      logger.warn(
        `Lock record ${lockId} not found, wallet may already be unlocked`
      );
      return { status: "already_unlocked" };
    }

    // Check if lock duration expired
    const now = new Date();
    if (now < lock.expiresAt) {
      // Not ready yet, reschedule
      const delay = lock.expiresAt - now;
      logger.info(`Lock not yet expired, rescheduling in ${delay}ms`);
      throw new Error("Lock not yet expired");
    }

    // Unlock wallet
    await WalletLock.updateOne(
      { _id: lockId },
      { isUnlocked: true, unlockedAt: now }
    );

    const wallet = await Wallet.findById(walletId);
    logger.info(`[WALLET UNLOCK] Wallet ${walletId} unlocked successfully`);

    return {
      status: "unlocked",
      walletId,
      previousBalance: wallet.balance,
    };
  } catch (error) {
    logger.error("[WALLET UNLOCK] Job failed:", error);
    throw error;
  }
}

/**
 * HEALTH SCAN PROCESSOR
 * Daily system health check
 */
async function healthScanJob(job) {
  try {
    logger.info(`[HEALTH SCAN] Starting daily health check`);

    const Transaction = require("../models/Transaction");
    const Wallet = require("../models/Wallet");
    const User = require("../models/User");
    const Host = require("../models/Host");

    const checks = {
      timestamp: new Date(),
      results: {},
    };

    // Check 1: Wallet balance consistency
    const walletCheck = await performWalletConsistencyCheck();
    checks.results.walletConsistency = walletCheck;

    // Check 2: Transaction integrity
    const txCheck = await performTransactionCheck();
    checks.results.transactionIntegrity = txCheck;

    // Check 3: User count & active users
    const userCheck = await performUserCheck();
    checks.results.userMetrics = userCheck;

    // Check 4: Database connection
    checks.results.databaseHealth = "healthy";

    logger.info(`[HEALTH SCAN] Completed:`, checks.results);

    // Create alert if issues detected
    const hasIssues = Object.values(checks.results).some(
      (result) => result.status === "failed" || result.issuesFound > 0
    );

    if (hasIssues) {
      await alertService.createAlert(
        "health_check_failed",
        "high",
        checks.results
      );
    }

    metricsService.trackCronExecution("daily_health_scan", 0, !hasIssues);

    return checks;
  } catch (error) {
    logger.error("[HEALTH SCAN] Job failed:", error);
    metricsService.trackError("health_scan_failed", error);
    throw error;
  }
}

async function performWalletConsistencyCheck() {
  const Wallet = require("../models/Wallet");
  const Transaction = require("../models/Transaction");

  const wallets = await Wallet.find().limit(1000);
  let issuesFound = 0;

  for (const wallet of wallets) {
    const transactions = await Transaction.find({ walletId: wallet._id });
    const calculatedBalance = transactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );

    if (Math.abs(calculatedBalance - wallet.balance) > 0) {
      issuesFound++;
    }
  }

  return {
    status: issuesFound > 0 ? "warning" : "healthy",
    walletsChecked: wallets.length,
    issuesFound,
  };
}

async function performTransactionCheck() {
  const Transaction = require("../models/Transaction");

  const transactions = await Transaction.find().limit(1000);
  let issuesFound = 0;

  // Check for incomplete transactions older than 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const staleTx = await Transaction.countDocuments({
    status: "pending",
    createdAt: { $lt: oneHourAgo },
  });

  issuesFound += staleTx;

  return {
    status: issuesFound > 0 ? "warning" : "healthy",
    transactionsChecked: transactions.length,
    issuesFound,
    staleTransactions: staleTx,
  };
}

async function performUserCheck() {
  const User = require("../models/User");

  const totalUsers = await User.countDocuments({});
  const activeToday = await User.countDocuments({
    lastActiveAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  return {
    status: "healthy",
    totalUsers,
    activeTodayCount: activeToday,
    activeRate: ((activeToday / totalUsers) * 100).toFixed(2) + "%",
  };
}

/**
 * FRAUD EXPIRY PROCESSOR
 * Expire fraud actions that have passed their duration
 */
async function fraudExpiryJob(job) {
  try {
    logger.info(`[FRAUD EXPIRY] Starting fraud action expiry check`);

    const result = await fraudEngine.processExpiredActions();

    logger.info(`[FRAUD EXPIRY] Completed:`, {
      expiredCount: result.expiredCount,
      updated: result.updated,
    });

    metricsService.trackCronExecution("fraud_expiry", 0, true);

    return result;
  } catch (error) {
    logger.error("[FRAUD EXPIRY] Job failed:", error);
    metricsService.trackError("fraud_expiry_failed", error);
    throw error;
  }
}

/**
 * ALERT DIGEST PROCESSOR
 * Send batched alert notifications
 */
async function alertDigestJob(job) {
  try {
    logger.info(`[ALERT DIGEST] Sending batched alerts to subscribed users`);

    const models = require("../models");
    const Alert = models.Alert;
    const User = models.User;

    // Get all alerts in the last hour that haven't been sent
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const pendingAlerts = await Alert.find({
      createdAt: { $gte: oneHourAgo },
      digestSent: false,
      severity: { $in: ["high", "critical"] },
    });

    let sentCount = 0;
    let failedCount = 0;

    // Group by user
    const alertsByUser = {};
    for (const alert of pendingAlerts) {
      if (!alertsByUser[alert.userId]) {
        alertsByUser[alert.userId] = [];
      }
      alertsByUser[alert.userId].push(alert);
    }

    // Send digest to each user
    for (const [userId, userAlerts] of Object.entries(alertsByUser)) {
      try {
        const user = await User.findById(userId);
        if (user && user.emailNotifications) {
          // Send email with alert digest
          await alertService.sendAlertDigestEmail(user, userAlerts);

          // Mark alerts as sent
          await Alert.updateMany(
            { _id: { $in: userAlerts.map((a) => a._id) } },
            { digestSent: true, digestSentAt: new Date() }
          );

          sentCount++;
        }
      } catch (error) {
        failedCount++;
        logger.error(`Failed to send digest to user ${userId}:`, error);
      }
    }

    const result = {
      alertsProcessed: pendingAlerts.length,
      usersNotified: sentCount,
      failures: failedCount,
    };

    logger.info(`[ALERT DIGEST] Completed:`, result);
    metricsService.trackCronExecution("alert_digest", 0, failedCount === 0);

    return result;
  } catch (error) {
    logger.error("[ALERT DIGEST] Job failed:", error);
    metricsService.trackError("alert_digest_failed", error);
    throw error;
  }
}

/**
 * Register all job processors
 * Call this in app.js after queue initialization
 */
async function registerJobProcessors() {
  try {
    const salary = queueService.getQueue("salary_cycle");
    const wallet = queueService.getQueue("wallet_unlock");
    const health = queueService.getQueue("health_scan");
    const fraud = queueService.getQueue("fraud_expiry");
    const alerts = queueService.getQueue("alert_digest");

    // Register processors
    salary.process("*", queueService.createJobProcessor(processSalaryCycleJob));
    wallet.process("*", queueService.createJobProcessor(walletUnlockJob));
    health.process("*", queueService.createJobProcessor(healthScanJob));
    fraud.process("*", queueService.createJobProcessor(fraudExpiryJob));
    alerts.process("*", queueService.createJobProcessor(alertDigestJob));

    logger.info("All job processors registered");
  } catch (error) {
    logger.error("Failed to register job processors:", error);
    throw error;
  }
}

module.exports = {
  registerJobProcessors,
  processSalaryCycleJob,
  walletUnlockJob,
  healthScanJob,
  fraudExpiryJob,
  alertDigestJob,
};
