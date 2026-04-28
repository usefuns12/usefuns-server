const mongoose = require("mongoose");
const logger = require("../classes/logger");

/**
 * STEP 7.2 - Data Archival Service
 *
 * Archives old data from hot collections to cold storage:
 * - GiftTransactions (>90 days)
 * - Alerts (resolved >90 days)
 * - Transactions (completed >90 days)
 * - FraudActions (expired/released >90 days)
 *
 * Keeps main collections lean and fast
 */

const ARCHIVE_AGE_DAYS = 90;

/**
 * Archive old gift transactions
 * Moves transactions older than 90 days to gifttransactions_archive
 */
async function archiveGiftTransactions() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AGE_DAYS);

    logger.info(
      `[Archival] Starting gift transaction archival (before ${cutoffDate.toISOString()})`
    );

    const db = mongoose.connection.db;
    const sourceCollection = db.collection("gifttransactions");
    const archiveCollection = db.collection("gifttransactions_archive");

    // Find old transactions
    const oldTransactions = await sourceCollection
      .find({
        createdAt: { $lt: cutoffDate },
      })
      .toArray();

    if (oldTransactions.length === 0) {
      logger.info("[Archival] No gift transactions to archive");
      return { archived: 0, deleted: 0 };
    }

    logger.info(
      `[Archival] Found ${oldTransactions.length} old gift transactions`
    );

    // Insert into archive (create if doesn't exist)
    if (oldTransactions.length > 0) {
      await archiveCollection.insertMany(oldTransactions, { ordered: false });
      logger.info(`[Archival] Inserted ${oldTransactions.length} into archive`);
    }

    // Delete from source
    const deleteResult = await sourceCollection.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    logger.info(
      `[Archival] Deleted ${deleteResult.deletedCount} from hot collection`
    );

    return {
      archived: oldTransactions.length,
      deleted: deleteResult.deletedCount,
    };
  } catch (error) {
    logger.error(
      `[Archival] Error archiving gift transactions: ${error.message}`
    );
    throw error;
  }
}

/**
 * Archive old resolved alerts
 * Moves resolved alerts older than 90 days
 */
async function archiveAlerts() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AGE_DAYS);

    logger.info(
      `[Archival] Starting alert archival (before ${cutoffDate.toISOString()})`
    );

    const db = mongoose.connection.db;
    const sourceCollection = db.collection("alerts");
    const archiveCollection = db.collection("alerts_archive");

    // Only archive resolved alerts
    const oldAlerts = await sourceCollection
      .find({
        status: "resolved",
        resolvedAt: { $lt: cutoffDate },
      })
      .toArray();

    if (oldAlerts.length === 0) {
      logger.info("[Archival] No alerts to archive");
      return { archived: 0, deleted: 0 };
    }

    logger.info(`[Archival] Found ${oldAlerts.length} old resolved alerts`);

    // Insert into archive
    if (oldAlerts.length > 0) {
      await archiveCollection.insertMany(oldAlerts, { ordered: false });
      logger.info(`[Archival] Inserted ${oldAlerts.length} into archive`);
    }

    // Delete from source
    const deleteResult = await sourceCollection.deleteMany({
      status: "resolved",
      resolvedAt: { $lt: cutoffDate },
    });

    logger.info(
      `[Archival] Deleted ${deleteResult.deletedCount} from hot collection`
    );

    return {
      archived: oldAlerts.length,
      deleted: deleteResult.deletedCount,
    };
  } catch (error) {
    logger.error(`[Archival] Error archiving alerts: ${error.message}`);
    throw error;
  }
}

/**
 * Archive old transactions
 * Moves completed transactions older than 90 days
 */
async function archiveTransactions() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AGE_DAYS);

    logger.info(
      `[Archival] Starting transaction archival (before ${cutoffDate.toISOString()})`
    );

    const db = mongoose.connection.db;
    const sourceCollection = db.collection("transactions");
    const archiveCollection = db.collection("transactions_archive");

    // Only archive completed/failed transactions
    const oldTransactions = await sourceCollection
      .find({
        status: { $in: ["completed", "failed"] },
        createdAt: { $lt: cutoffDate },
      })
      .toArray();

    if (oldTransactions.length === 0) {
      logger.info("[Archival] No transactions to archive");
      return { archived: 0, deleted: 0 };
    }

    logger.info(`[Archival] Found ${oldTransactions.length} old transactions`);

    // Insert into archive
    if (oldTransactions.length > 0) {
      await archiveCollection.insertMany(oldTransactions, { ordered: false });
      logger.info(`[Archival] Inserted ${oldTransactions.length} into archive`);
    }

    // Delete from source
    const deleteResult = await sourceCollection.deleteMany({
      status: { $in: ["completed", "failed"] },
      createdAt: { $lt: cutoffDate },
    });

    logger.info(
      `[Archival] Deleted ${deleteResult.deletedCount} from hot collection`
    );

    return {
      archived: oldTransactions.length,
      deleted: deleteResult.deletedCount,
    };
  } catch (error) {
    logger.error(`[Archival] Error archiving transactions: ${error.message}`);
    throw error;
  }
}

/**
 * Archive old fraud actions
 * Moves expired/released fraud actions older than 90 days
 */
async function archiveFraudActions() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AGE_DAYS);

    logger.info(
      `[Archival] Starting fraud action archival (before ${cutoffDate.toISOString()})`
    );

    const db = mongoose.connection.db;
    const sourceCollection = db.collection("fraudactions");
    const archiveCollection = db.collection("fraudactions_archive");

    // Only archive expired/released actions
    const oldActions = await sourceCollection
      .find({
        status: { $in: ["expired", "released"] },
        updatedAt: { $lt: cutoffDate },
      })
      .toArray();

    if (oldActions.length === 0) {
      logger.info("[Archival] No fraud actions to archive");
      return { archived: 0, deleted: 0 };
    }

    logger.info(`[Archival] Found ${oldActions.length} old fraud actions`);

    // Insert into archive
    if (oldActions.length > 0) {
      await archiveCollection.insertMany(oldActions, { ordered: false });
      logger.info(`[Archival] Inserted ${oldActions.length} into archive`);
    }

    // Delete from source
    const deleteResult = await sourceCollection.deleteMany({
      status: { $in: ["expired", "released"] },
      updatedAt: { $lt: cutoffDate },
    });

    logger.info(
      `[Archival] Deleted ${deleteResult.deletedCount} from hot collection`
    );

    return {
      archived: oldActions.length,
      deleted: deleteResult.deletedCount,
    };
  } catch (error) {
    logger.error(`[Archival] Error archiving fraud actions: ${error.message}`);
    throw error;
  }
}

/**
 * Run full archival process
 * Executes all archival functions
 */
async function runFullArchival() {
  logger.info(
    "[Archival] ========== Starting Full Archival Process =========="
  );

  const results = {
    startTime: new Date(),
    giftTransactions: { archived: 0, deleted: 0, error: null },
    alerts: { archived: 0, deleted: 0, error: null },
    transactions: { archived: 0, deleted: 0, error: null },
    fraudActions: { archived: 0, deleted: 0, error: null },
  };

  // Archive gift transactions
  try {
    results.giftTransactions = await archiveGiftTransactions();
  } catch (error) {
    results.giftTransactions.error = error.message;
    logger.error(
      `[Archival] Gift transaction archival failed: ${error.message}`
    );
  }

  // Archive alerts
  try {
    results.alerts = await archiveAlerts();
  } catch (error) {
    results.alerts.error = error.message;
    logger.error(`[Archival] Alert archival failed: ${error.message}`);
  }

  // Archive transactions
  try {
    results.transactions = await archiveTransactions();
  } catch (error) {
    results.transactions.error = error.message;
    logger.error(`[Archival] Transaction archival failed: ${error.message}`);
  }

  // Archive fraud actions
  try {
    results.fraudActions = await archiveFraudActions();
  } catch (error) {
    results.fraudActions.error = error.message;
    logger.error(`[Archival] Fraud action archival failed: ${error.message}`);
  }

  results.endTime = new Date();
  results.durationMs = results.endTime - results.startTime;

  logger.info("[Archival] ========== Archival Complete ==========");
  logger.info(
    `[Archival] Duration: ${(results.durationMs / 1000).toFixed(2)}s`
  );
  logger.info(
    `[Archival] Gift Transactions: ${results.giftTransactions.archived} archived, ${results.giftTransactions.deleted} deleted`
  );
  logger.info(
    `[Archival] Alerts: ${results.alerts.archived} archived, ${results.alerts.deleted} deleted`
  );
  logger.info(
    `[Archival] Transactions: ${results.transactions.archived} archived, ${results.transactions.deleted} deleted`
  );
  logger.info(
    `[Archival] Fraud Actions: ${results.fraudActions.archived} archived, ${results.fraudActions.deleted} deleted`
  );

  return results;
}

/**
 * Get archival statistics
 */
async function getArchivalStats() {
  try {
    const db = mongoose.connection.db;

    const stats = {
      hot: {},
      archive: {},
    };

    // Hot collections
    const hotCollections = [
      "gifttransactions",
      "alerts",
      "transactions",
      "fraudactions",
    ];
    for (const name of hotCollections) {
      try {
        const collection = db.collection(name);
        const count = await collection.countDocuments();
        const size = await collection.stats().then((s) => s.size);
        stats.hot[name] = { count, size };
      } catch (error) {
        stats.hot[name] = { count: 0, size: 0, error: "Collection not found" };
      }
    }

    // Archive collections
    const archiveCollections = [
      "gifttransactions_archive",
      "alerts_archive",
      "transactions_archive",
      "fraudactions_archive",
    ];
    for (const name of archiveCollections) {
      try {
        const collection = db.collection(name);
        const count = await collection.countDocuments();
        const size = await collection.stats().then((s) => s.size);
        stats.archive[name] = { count, size };
      } catch (error) {
        stats.archive[name] = {
          count: 0,
          size: 0,
          error: "Collection not found",
        };
      }
    }

    return stats;
  } catch (error) {
    logger.error(`[Archival] Error getting stats: ${error.message}`);
    throw error;
  }
}

module.exports = {
  archiveGiftTransactions,
  archiveAlerts,
  archiveTransactions,
  archiveFraudActions,
  runFullArchival,
  getArchivalStats,
  ARCHIVE_AGE_DAYS,
};
