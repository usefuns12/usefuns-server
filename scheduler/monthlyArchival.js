const cron = require("node-cron");
const archivalService = require("../services/archival.service");
const logger = require("../classes/logger");

/**
 * STEP 7.2 - Archival Scheduler
 *
 * Runs monthly to archive old data from hot collections
 * Keeps main DB lean and fast
 *
 * Schedule: 1st of every month at 2 AM
 */

let jobScheduled = false;

/**
 * Schedule monthly archival job
 */
function scheduleMonthlyArchival() {
  if (jobScheduled) {
    logger.info("[ArchivalScheduler] Monthly archival already scheduled");
    return;
  }

  // Run on 1st of every month at 2:00 AM
  // Format: minute hour day month day-of-week
  cron.schedule("0 2 1 * *", async () => {
    logger.info(
      "[ArchivalScheduler] ========== Starting Monthly Archival =========="
    );
    logger.info(`[ArchivalScheduler] Time: ${new Date().toISOString()}`);

    try {
      const results = await archivalService.runFullArchival();

      // Log summary
      const totalArchived =
        results.giftTransactions.archived +
        results.alerts.archived +
        results.transactions.archived +
        results.fraudActions.archived;

      const totalDeleted =
        results.giftTransactions.deleted +
        results.alerts.deleted +
        results.transactions.deleted +
        results.fraudActions.deleted;

      logger.info("[ArchivalScheduler] ========== Archival Summary ==========");
      logger.info(
        `[ArchivalScheduler] Total archived: ${totalArchived} documents`
      );
      logger.info(
        `[ArchivalScheduler] Total deleted: ${totalDeleted} documents`
      );
      logger.info(
        `[ArchivalScheduler] Duration: ${(results.durationMs / 1000).toFixed(
          2
        )}s`
      );

      // Check for errors
      const errors = [];
      if (results.giftTransactions.error)
        errors.push(`GiftTransactions: ${results.giftTransactions.error}`);
      if (results.alerts.error) errors.push(`Alerts: ${results.alerts.error}`);
      if (results.transactions.error)
        errors.push(`Transactions: ${results.transactions.error}`);
      if (results.fraudActions.error)
        errors.push(`FraudActions: ${results.fraudActions.error}`);

      if (errors.length > 0) {
        logger.error("[ArchivalScheduler] Errors during archival:");
        errors.forEach((err) => logger.error(`  - ${err}`));
      }

      // Get new stats
      try {
        const stats = await archivalService.getArchivalStats();
        logger.info("[ArchivalScheduler] Post-archival stats:");
        Object.entries(stats.hot).forEach(([name, data]) => {
          logger.info(
            `  Hot ${name}: ${data.count} docs (${(
              data.size /
              1024 /
              1024
            ).toFixed(2)} MB)`
          );
        });
      } catch (statsError) {
        logger.error(
          `[ArchivalScheduler] Error getting stats: ${statsError.message}`
        );
      }

      logger.info(
        "[ArchivalScheduler] ========== Monthly Archival Complete =========="
      );
    } catch (error) {
      logger.error(
        `[ArchivalScheduler] Fatal error during archival: ${error.message}`
      );
      logger.error(error.stack);
      // Don't throw - keep scheduler running
    }
  });

  jobScheduled = true;
  logger.info(
    "[ArchivalScheduler] Monthly archival scheduled (1st of month at 2:00 AM)"
  );
}

/**
 * Run archival immediately (for testing or manual trigger)
 */
async function runArchivalNow() {
  logger.info("[ArchivalScheduler] Manual archival triggered");
  try {
    const results = await archivalService.runFullArchival();
    logger.info("[ArchivalScheduler] Manual archival complete");
    return results;
  } catch (error) {
    logger.error(
      `[ArchivalScheduler] Manual archival failed: ${error.message}`
    );
    throw error;
  }
}

module.exports = {
  scheduleMonthlyArchival,
  runArchivalNow,
};
