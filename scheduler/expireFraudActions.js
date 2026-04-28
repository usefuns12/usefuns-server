const cron = require("node-cron");
const fraudEngine = require("../services/fraudEngine.service");
const loggerFactory = require("../classes/logger");
const logger = loggerFactory(__filename);

/**
 * STEP 6 - Fraud Action Expiry Scheduler
 *
 * Runs every hour to mark expired fraud actions
 * Non-blocking, lightweight
 */

let jobScheduled = false;

/**
 * Schedule hourly job to process expired fraud actions
 */
function scheduleFraudActionExpiry() {
  if (jobScheduled) {
    logger.info("[FraudScheduler] Fraud action expiry already scheduled");
    return;
  }

  // Run every hour at minute 0 (e.g., 12:00, 13:00, 14:00)
  cron.schedule("0 * * * *", async () => {
    logger.info("[FraudScheduler] Running fraud action expiry job...");

    try {
      const processedCount = await fraudEngine.processExpiredActions();

      if (processedCount > 0) {
        logger.info(
          `[FraudScheduler] Processed ${processedCount} expired fraud actions`
        );
      }
    } catch (error) {
      logger.error(
        `[FraudScheduler] Error processing expired actions: ${error.message}`
      );
      // Never throw - keep scheduler running
    }
  });

  jobScheduled = true;
  logger.info("[FraudScheduler] Fraud action expiry scheduled (hourly at :00)");
}

module.exports = {
  scheduleFraudActionExpiry,
};
