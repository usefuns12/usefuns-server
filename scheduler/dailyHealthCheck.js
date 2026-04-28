const cron = require("node-cron");
const alertService = require("../services/alert.service");
const models = require("../models");
const HostSalaryCycle = models.HostSalaryCycle;
const Dispute = models.Dispute;
const Wallet = models.Wallet;
const Alert = models.Alert;

/**
 * 📊 STEP 5.4: Daily comprehensive health scan
 * Checks for silent issues that don't trigger event-based alerts
 * Runs every day at 3:00 AM (after salary and unlock jobs)
 */
const scheduleDailyHealthCheck = () => {
  // Run daily at 3:00 AM
  cron.schedule("0 3 * * *", async () => {
    console.log("📊 [CRON] Starting daily system health check...");

    const startTime = Date.now();
    const results = {
      checked: [],
      alerts_created: 0,
      errors: [],
    };

    try {
      // ✅ Check 1: Stuck salary cycles (pending > 24 hours)
      try {
        await alertService.detectStuckCycle();
        results.checked.push("stuck_cycles");
      } catch (err) {
        console.error("Error checking stuck cycles:", err.message);
        results.errors.push({ check: "stuck_cycles", error: err.message });
      }

      // ✅ Check 2: Wallet mismatches
      try {
        await alertService.detectWalletMismatch();
        results.checked.push("wallet_mismatch");
      } catch (err) {
        console.error("Error checking wallet mismatches:", err.message);
        results.errors.push({ check: "wallet_mismatch", error: err.message });
      }

      // ✅ Check 3: Zero salary patterns
      try {
        await alertService.detectZeroSalary();
        results.checked.push("zero_salary");
      } catch (err) {
        console.error("Error checking zero salary:", err.message);
        results.errors.push({ check: "zero_salary", error: err.message });
      }

      // ✅ Check 4: Salary drop patterns
      try {
        await alertService.detectSalaryDrop();
        results.checked.push("salary_drop");
      } catch (err) {
        console.error("Error checking salary drop:", err.message);
        results.errors.push({ check: "salary_drop", error: err.message });
      }

      // ✅ Check 5: VIP anomalies
      try {
        await alertService.detectVIPAnomaly();
        results.checked.push("vip_anomaly");
      } catch (err) {
        console.error("Error checking VIP anomalies:", err.message);
        results.errors.push({ check: "vip_anomaly", error: err.message });
      }

      // ✅ Check 6: Commission patterns
      try {
        await alertService.detectCommissionDrop();
        results.checked.push("commission_drop");
      } catch (err) {
        console.error("Error checking commission drop:", err.message);
        results.errors.push({
          check: "commission_drop",
          error: err.message,
        });
      }

      // ✅ Check 7: Gift patterns
      try {
        await alertService.detectGiftVelocity();
        await alertService.detectGiftLoop();
        results.checked.push("gift_anomalies");
      } catch (err) {
        console.error("Error checking gift anomalies:", err.message);
        results.errors.push({ check: "gift_anomalies", error: err.message });
      }

      // ✅ Check 8: Count metrics
      const metrics = {
        open_alerts: await Alert.countDocuments({ status: "open" }),
        critical_alerts: await Alert.countDocuments({
          status: "open",
          severity: "critical",
        }),
        open_disputes: await Dispute.countDocuments({ status: "open" }),
        pending_disputes: await Dispute.countDocuments({
          status: "pending",
        }),
        stuck_cycles: await HostSalaryCycle.countDocuments({
          status: "pending",
          createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
      };

      results.metrics = metrics;

      const duration = Date.now() - startTime;

      console.log(`✅ [CRON] Daily health check completed in ${duration}ms:`);
      console.log(`   Checks: ${results.checked.join(", ")}`);
      console.log(`   Metrics:
        - Open Alerts: ${metrics.open_alerts}
        - Critical Alerts: ${metrics.critical_alerts}
        - Open Disputes: ${metrics.open_disputes}
        - Stuck Cycles: ${metrics.stuck_cycles}
      `);

      if (results.errors.length > 0) {
        console.error(`   Errors encountered: ${results.errors.length}`);
        results.errors.forEach((err) => {
          console.error(`     - ${err.check}: ${err.error}`);
        });
      }

      return results;
    } catch (err) {
      console.error("❌ [CRON] Unexpected error in daily health check:", err);

      // Log the health check failure as a system alert
      try {
        await alertService.createAlert({
          type: "system_error",
          severity: "critical",
          referenceType: "cron",
          message: "Daily health check failed",
          meta: {
            error: err.message,
            checks_completed: results.checked.length,
            errors_encountered: results.errors.length,
          },
          deduplicationKey: `daily_health_check_failure_${new Date()
            .toISOString()
            .slice(0, 10)}`,
        });
      } catch (alertErr) {
        console.error(
          "Failed to create health check failure alert:",
          alertErr.message
        );
      }

      throw err;
    }
  });

  console.log(
    "✅ Daily health check scheduler initialized (runs daily at 3:00 AM)"
  );
};

module.exports = { scheduleDailyHealthCheck };
