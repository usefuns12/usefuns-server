const models = require("../models");
const Alert = models.Alert;
const Host = models.Host;
const Agency = models.Agency;
const User = models.User;
const Wallet = models.Wallet;
const Transaction = models.Transaction;
const HostSalaryCycle = models.HostSalaryCycle;
const AgencyCommissionCycle = models.AgencyCommissionCycle;
const GiftTransaction = models.GiftTransaction;
const notificationService = require("./notification.service");
const fraudEngine = require("./fraudEngine.service");

const logger = console; // Replace with actual logger

/**
 * Alert Service - Detects anomalies and creates alerts
 * All checks are deduped to avoid spam
 */

// ============================================================================
// CORE UTILITY: Create Alert with Deduplication
// ============================================================================

async function createAlert({
  type,
  severity,
  referenceType,
  referenceId,
  message,
  meta = {},
  deduplicationKey,
}) {
  try {
    // Check for existing open/acknowledged alert with same dedup key
    if (deduplicationKey) {
      const existing = await Alert.findOne({
        deduplicationKey,
        status: { $in: ["open", "acknowledged"] },
      });

      if (existing) {
        // Alert already exists, don't spam
        return existing;
      }
    }

    // Create new alert
    const alert = new Alert({
      type,
      severity,
      referenceType,
      referenceId,
      message,
      meta,
      deduplicationKey,
      auditLog: [
        {
          action: "created",
          timestamp: new Date(),
          note: "Alert automatically generated",
        },
      ],
    });

    await alert.save();

    logger.info(`Alert created: ${type} for ${referenceType}:${referenceId}`);

    // Fire-and-forget notification & fraud action check
    try {
      setImmediate(async () => {
        try {
          // Step 1: Notify admins
          await notificationService.notifyAdmins(alert);

          // Step 2: Check if this alert triggers a fraud action
          const actionData = await fraudEngine.checkAlertForAction(alert);
          if (actionData) {
            try {
              await fraudEngine.applyFraudAction(actionData);
            } catch (fraudErr) {
              logger.error("Fraud action failed:", fraudErr.message);
              // Non-blocking
            }
          }
        } catch (notifErr) {
          logger.error("Alert post-processing failed:", notifErr.message);
          // Never throw - don't block alert system
        }
      });
    } catch (notifErr) {
      logger.error("Failed to queue alert processing:", notifErr.message);
    }

    return alert;
  } catch (err) {
    logger.error("Error creating alert:", err.message);
    throw err;
  }
}

// ============================================================================
// SALARY ANOMALY DETECTION
// ============================================================================

/**
 * Detect if host has 0 salary for 2+ consecutive cycles
 * Run: Daily
 */
async function detectZeroSalary() {
  logger.info("Running zero salary detection...");

  try {
    const hosts = await Host.find({ isActive: true });

    for (const host of hosts) {
      // Get last 2 salary cycles
      const cycles = await HostSalaryCycle.find({ hostId: host._id })
        .sort({ endDate: -1 })
        .limit(2);

      if (cycles.length >= 2) {
        const lastCycle = cycles[0];
        const prevCycle = cycles[1];

        // Both cycles have 0 salary
        if (lastCycle.salaryUcoins === 0 && prevCycle.salaryUcoins === 0) {
          await createAlert({
            type: "salary_zero",
            severity: "high",
            referenceType: "host",
            referenceId: host._id,
            message: `Host ${host.name} has 0 salary for 2 consecutive cycles`,
            meta: {
              cycles: [
                {
                  id: lastCycle._id,
                  period: `${lastCycle.startDate} to ${lastCycle.endDate}`,
                  amount: 0,
                },
                {
                  id: prevCycle._id,
                  period: `${prevCycle.startDate} to ${prevCycle.endDate}`,
                  amount: 0,
                },
              ],
            },
            deduplicationKey: `salary_zero_${host._id}`,
          });
        }
      }
    }
  } catch (err) {
    logger.error("Error in detectZeroSalary:", err.message);
  }
}

/**
 * Detect if host salary dropped > 40% vs last cycle
 * Run: Daily (after salary calculation)
 */
async function detectSalaryDrop() {
  logger.info("Running salary drop detection...");

  try {
    const hosts = await Host.find({ isActive: true });

    for (const host of hosts) {
      // Get last 2 cycles
      const cycles = await HostSalaryCycle.find({ hostId: host._id })
        .sort({ endDate: -1 })
        .limit(2);

      if (cycles.length >= 2) {
        const lastCycle = cycles[0];
        const prevCycle = cycles[1];

        // Skip if previous was 0 (can't calculate percentage drop)
        if (prevCycle.salaryUcoins === 0) continue;

        const dropPercent =
          ((prevCycle.salaryUcoins - lastCycle.salaryUcoins) /
            prevCycle.salaryUcoins) *
          100;

        // Drop > 40%
        if (dropPercent > 40 && lastCycle.salaryUcoins > 0) {
          await createAlert({
            type: "salary_drop",
            severity: "high",
            referenceType: "host",
            referenceId: host._id,
            message: `Host ${host.name} salary dropped ${dropPercent.toFixed(
              1,
            )}% (${prevCycle.salaryUcoins} → ${lastCycle.salaryUcoins})`,
            meta: {
              previousAmount: prevCycle.salaryUcoins,
              currentAmount: lastCycle.salaryUcoins,
              dropPercent: dropPercent.toFixed(1),
              previousCycleId: prevCycle._id,
              currentCycleId: lastCycle._id,
            },
            deduplicationKey: `salary_drop_${host._id}_${lastCycle._id}`,
          });
        }
      }
    }
  } catch (err) {
    logger.error("Error in detectSalaryDrop:", err.message);
  }
}

/**
 * Detect if host met VIP target but worked 0 hours (abuse check)
 * Run: Daily (after salary calculation)
 */
async function detectVIPAnomaly() {
  logger.info("Running VIP anomaly detection...");

  try {
    // Get hosts with VIP status
    const vipHosts = await Host.find({ isVIP: true, isActive: true });

    for (const host of vipHosts) {
      const lastCycle = await HostSalaryCycle.findOne({
        hostId: host._id,
      }).sort({ endDate: -1 });

      if (!lastCycle) continue;

      // Check if salary is present but hours = 0
      if (lastCycle.salaryUcoins > 0 && lastCycle.hours === 0) {
        await createAlert({
          type: "vip_anomaly",
          severity: "medium",
          referenceType: "host",
          referenceId: host._id,
          message: `VIP Host ${host.name} received ${lastCycle.salaryUcoins} U-coins but worked 0 hours`,
          meta: {
            cycleId: lastCycle._id,
            salary: lastCycle.salaryUcoins,
            hours: 0,
            diamonds: lastCycle.diamonds,
          },
          deduplicationKey: `vip_anomaly_${host._id}_${lastCycle._id}`,
        });
      }
    }
  } catch (err) {
    logger.error("Error in detectVIPAnomaly:", err.message);
  }
}

// ============================================================================
// COMMISSION ANOMALY DETECTION
// ============================================================================

/**
 * Detect if agency commission dropped > 40%
 * Run: Daily (after commission calculation)
 */
async function detectCommissionDrop() {
  logger.info("Running commission drop detection...");

  try {
    const agencies = await Agency.find({ isActive: true });

    for (const agency of agencies) {
      // Get last 2 commission cycles
      const cycles = await AgencyCommissionCycle.find({ agencyId: agency._id })
        .sort({ createdAt: -1 })
        .limit(2);

      if (cycles.length >= 2) {
        const lastCycle = cycles[0];
        const prevCycle = cycles[1];

        if (prevCycle.commissionUcoins === 0) continue;

        const dropPercent =
          ((prevCycle.commissionUcoins - lastCycle.commissionUcoins) /
            prevCycle.commissionUcoins) *
          100;

        if (dropPercent > 40 && lastCycle.commissionUcoins > 0) {
          await createAlert({
            type: "commission_drop",
            severity: "high",
            referenceType: "agency",
            referenceId: agency._id,
            message: `Agency ${
              agency.name
            } commission dropped ${dropPercent.toFixed(1)}% (${
              prevCycle.commissionUcoins
            } → ${lastCycle.commissionUcoins})`,
            meta: {
              previousAmount: prevCycle.commissionUcoins,
              currentAmount: lastCycle.commissionUcoins,
              dropPercent: dropPercent.toFixed(1),
            },
            deduplicationKey: `commission_drop_${agency._id}_${lastCycle._id}`,
          });
        }
      }
    }
  } catch (err) {
    logger.error("Error in detectCommissionDrop:", err.message);
  }
}

// ============================================================================
// GIFT ANOMALY DETECTION
// ============================================================================

/**
 * Detect gift velocity spike (10x average in last hour)
 * Run: Every 15 minutes
 */
async function detectGiftVelocity() {
  logger.info("Running gift velocity detection...");

  try {
    const now = new Date();
    const last1Hour = new Date(now.getTime() - 60 * 60 * 1000);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get users who sent gifts in last hour
    const recentGivers = await GiftTransaction.aggregate([
      {
        $match: {
          sender: { $exists: true },
          createdAt: { $gte: last1Hour },
        },
      },
      {
        $group: {
          _id: "$sender",
          count: { $sum: 1 },
          totalDiamonds: { $sum: "$totalDiamonds" },
        },
      },
    ]);

    for (const giver of recentGivers) {
      // Get 24-hour average for this user
      const last24hGifts = await GiftTransaction.countDocuments({
        sender: giver._id,
        createdAt: { $gte: last24Hours },
      });

      const avg24h = last24hGifts / 24; // Per hour average
      const spike = giver.count / (avg24h || 1);

      // Alert if 10x average
      if (spike > 10) {
        await createAlert({
          type: "gift_velocity",
          severity: "high",
          referenceType: "user",
          referenceId: giver._id,
          message: `User sent ${
            giver.count
          } gifts in last hour (${spike.toFixed(1)}x average), ${
            giver.totalDiamonds
          } diamonds`,
          meta: {
            giftCount: giver.count,
            diamonds: giver.totalDiamonds,
            hourlyAverage: avg24h.toFixed(2),
            spike: spike.toFixed(1),
          },
          deduplicationKey: `gift_velocity_${giver._id}_${now
            .toISOString()
            .slice(0, 13)}`,
        });
      }
    }
  } catch (err) {
    logger.error("Error in detectGiftVelocity:", err.message);
  }
}

/**
 * Detect gift loop: same sender → same host repeatedly
 * Run: Daily
 */
async function detectGiftLoop() {
  logger.info("Running gift loop detection...");

  try {
    // Get gift pairs that occur > 10 times
    const loops = await GiftTransaction.aggregate([
      {
        $group: {
          _id: {
            senderId: "$sender",
            receiverId: "$receiver",
          },
          count: { $sum: 1 },
          totalDiamonds: { $sum: "$totalDiamonds" },
        },
      },
      {
        $match: { count: { $gte: 10 } },
      },
    ]);

    for (const loop of loops) {
      await createAlert({
        type: "gift_loop",
        severity: "medium",
        referenceType: "user",
        referenceId: loop._id.senderId,
        message: `User has gifted same host ${loop.count} times (${loop.totalDiamonds} diamonds)`,
        meta: {
          senderId: loop._id.senderId,
          receiverId: loop._id.receiverId,
          giftCount: loop.count,
          totalDiamonds: loop.totalDiamonds,
        },
        deduplicationKey: `gift_loop_${loop._id.senderId}_${loop._id.receiverId}`,
      });
    }
  } catch (err) {
    logger.error("Error in detectGiftLoop:", err.message);
  }
}

/**
 * Detect self-gifting attempts
 * Run: Real-time (before gift is saved)
 */
async function detectSelfGift(senderId, receiverId) {
  if (senderId.toString() === receiverId.toString()) {
    await createAlert({
      type: "self_gift",
      severity: "low",
      referenceType: "user",
      referenceId: senderId,
      message: `User attempted to gift themselves`,
      meta: { senderId, receiverId },
      deduplicationKey: `self_gift_${senderId}`,
    });

    return true; // Block the gift
  }

  return false; // Allow gift
}

// ============================================================================
// WALLET ANOMALY DETECTION
// ============================================================================

/**
 * Detect wallet mismatch: sum of transactions ≠ wallet balance
 * Run: Daily
 */
async function detectWalletMismatch() {
  logger.info("Running wallet mismatch detection...");

  try {
    const wallets = await Wallet.find();

    for (const wallet of wallets) {
      // Sum all transactions for this user
      const txnResult = await Transaction.aggregate([
        {
          $match: { userId: wallet.userId },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      const calculatedBalance =
        txnResult.length > 0 ? txnResult[0].totalAmount : 0;

      // Compare with wallet total
      if (Math.abs(calculatedBalance - wallet.totalUcoins) > 1) {
        // Allow 1 coin tolerance for rounding
        await createAlert({
          type: "wallet_mismatch",
          severity: "critical",
          referenceType: "wallet",
          referenceId: wallet._id,
          message: `Wallet balance mismatch: wallet=${wallet.totalUcoins}, calculated=${calculatedBalance}`,
          meta: {
            walletId: wallet._id,
            walletBalance: wallet.totalUcoins,
            calculatedBalance,
            difference: calculatedBalance - wallet.totalUcoins,
            withdrawable: wallet.withdrawableUcoins,
            locked: wallet.lockedUcoins,
          },
          deduplicationKey: `wallet_mismatch_${wallet._id}`,
        });
      }
    }
  } catch (err) {
    logger.error("Error in detectWalletMismatch:", err.message);
  }
}

// ============================================================================
// SYSTEM FAILURE DETECTION
// ============================================================================

/**
 * Detect if cron job did not run
 * Call this manually after checking cron logs
 */
async function detectCronFailure(jobName, error) {
  await createAlert({
    type: "cron_failure",
    severity: "critical",
    referenceType: "cron",
    message: `Cron job '${jobName}' failed: ${error}`,
    meta: {
      jobName,
      error,
      timestamp: new Date(),
    },
    deduplicationKey: `cron_failure_${jobName}_${new Date()
      .toISOString()
      .slice(0, 19)}`,
  });
}

/**
 * Detect if wallet unlock cron failed
 * Called from wallet unlock cron error handler
 */
async function detectUnlockFailure(error) {
  await createAlert({
    type: "unlock_failure",
    severity: "critical",
    referenceType: "cron",
    message: `Wallet unlock cron failed: ${error}`,
    meta: {
      error,
      timestamp: new Date(),
    },
    deduplicationKey: `unlock_failure_${new Date().toISOString().slice(0, 13)}`,
  });
}

/**
 * Detect if salary cycle is stuck in pending
 * Run: Every 6 hours
 */
async function detectStuckCycle() {
  logger.info("Running stuck cycle detection...");

  try {
    const stuckThreshold = 24 * 60 * 60 * 1000; // 24 hours
    const now = new Date();

    const stuckCycles = await HostSalaryCycle.find({
      status: "pending",
      createdAt: { $lt: new Date(now.getTime() - stuckThreshold) },
    });

    for (const cycle of stuckCycles) {
      const hoursStuck = (now - cycle.createdAt) / (60 * 60 * 1000);

      await createAlert({
        type: "cycle_stuck",
        severity: "high",
        referenceType: "cycle",
        referenceId: cycle._id,
        message: `Salary cycle for host ${
          cycle.hostId
        } stuck in pending for ${hoursStuck.toFixed(1)} hours`,
        meta: {
          cycleId: cycle._id,
          hostId: cycle.hostId,
          hoursStuck: hoursStuck.toFixed(1),
          createdAt: cycle.createdAt,
        },
        deduplicationKey: `cycle_stuck_${cycle._id}`,
      });
    }
  } catch (err) {
    logger.error("Error in detectStuckCycle:", err.message);
  }
}

// ============================================================================
// AGGREGATE CHECK: Run All Checks
// ============================================================================

async function runAllChecks() {
  logger.info("========== ALERT CHECK CYCLE START ==========");

  await detectZeroSalary();
  await detectSalaryDrop();
  await detectVIPAnomaly();
  await detectCommissionDrop();
  await detectGiftVelocity();
  await detectGiftLoop();
  await detectWalletMismatch();
  await detectStuckCycle();

  logger.info("========== ALERT CHECK CYCLE END ==========");
}

module.exports = {
  createAlert,
  detectZeroSalary,
  detectSalaryDrop,
  detectVIPAnomaly,
  detectCommissionDrop,
  detectGiftVelocity,
  detectGiftLoop,
  detectSelfGift,
  detectWalletMismatch,
  detectCronFailure,
  detectUnlockFailure,
  detectStuckCycle,
  runAllChecks,
};
