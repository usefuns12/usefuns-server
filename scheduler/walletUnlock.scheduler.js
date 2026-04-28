const cron = require("node-cron");
const {
  unlockEligibleFunds,
  checkWalletAnomalies,
} = require("../services/walletUnlock.service");
const alertService = require("../services/alert.service");

/**
 * 🔓 STEP 3: Daily auto-unlock scheduler
 * Runs every day at 2:00 AM
 * Unlocks salary funds that have passed their lock period
 */
const scheduleWalletUnlock = () => {
  // Run daily at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    try {
      console.log("🔓 [CRON] Starting daily wallet unlock job...");

      const result = await unlockEligibleFunds();

      console.log(`✅ [CRON] Wallet unlock completed:
        - Processed: ${result.processed}
        - Unlocked: ${result.unlocked}
        - Failed: ${result.failed}
        - Total Amount: ${result.totalAmount} U-coins
      `);

      // ✅ STEP 5.4: Check for wallet anomalies after unlock (fire-and-forget)
      try {
        await checkWalletAnomalies();
      } catch (err) {
        console.error("Wallet anomaly check failed:", err.message);
      }
    } catch (err) {
      console.error("❌ [CRON] Error running wallet unlock task:", err);

      // ✅ STEP 5.4: Create alert on cron failure (fire-and-forget)
      try {
        await alertService.detectUnlockFailure(err.message);
      } catch (alertErr) {
        console.error(
          "Failed to create unlock failure alert:",
          alertErr.message
        );
      }
    }
  });

  console.log("✅ Wallet unlock scheduler initialized (runs daily at 2:00 AM)");
};

module.exports = { scheduleWalletUnlock };
