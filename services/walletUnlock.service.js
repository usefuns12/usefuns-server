const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const Policy = require("../models/Policy");
const alertService = require("./alert.service");

/**
 * 🔓 Unlock salary funds that have passed their lock period
 * Moves lockedUcoins → withdrawableUcoins
 *
 * Called by:
 * - Daily cron job (automatic unlock)
 * - Admin manual unlock (force unlock)
 */
async function unlockEligibleFunds() {
  try {
    console.log("🔓 Starting wallet unlock process...");

    // Get policy settings
    const policy = await Policy.findOne({ type: "hostSalary" });
    const autoUnlock = policy?.hostSalary?.unlockRules?.autoUnlock ?? true;

    if (!autoUnlock) {
      console.log("⚠️ Auto-unlock disabled by policy. Skipping.");
      return {
        success: true,
        message: "Auto-unlock disabled",
        processed: 0,
      };
    }

    // Find all locked transactions past their unlock date
    const eligibleTransactions = await Transaction.find({
      status: "locked",
      lockedUntil: { $lte: new Date() },
      type: "salary", // Only unlock salary transactions
    }).lean();

    console.log(
      `📊 Found ${eligibleTransactions.length} transactions ready to unlock`
    );

    const results = [];
    let totalUnlocked = 0;

    for (const txn of eligibleTransactions) {
      try {
        await unlockTransaction(txn._id, "auto");
        totalUnlocked += txn.amount;
        results.push({ transactionId: txn._id, success: true });
      } catch (error) {
        console.error(`❌ Failed to unlock transaction ${txn._id}:`, error);
        results.push({
          transactionId: txn._id,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(
      `✅ Unlocked ${
        results.filter((r) => r.success).length
      } transactions (${totalUnlocked} U-coins)`
    );

    return {
      success: true,
      processed: results.length,
      unlocked: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      totalAmount: totalUnlocked,
      results,
    };
  } catch (error) {
    console.error("Error in unlockEligibleFunds:", error);
    throw error;
  }
}

/**
 * 🔓 Unlock a specific transaction
 * @param {ObjectId} transactionId - Transaction to unlock
 * @param {String} unlockedBy - 'auto' or 'admin'
 */
async function unlockTransaction(transactionId, unlockedBy = "auto") {
  const session = await Transaction.startSession();
  session.startTransaction();

  try {
    // Get transaction
    const transaction = await Transaction.findById(transactionId).session(
      session
    );

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status !== "locked") {
      throw new Error(
        `Transaction status is ${transaction.status}, not locked`
      );
    }

    // Update wallet: move locked → withdrawable
    const wallet = await Wallet.findOneAndUpdate(
      { userId: transaction.userId.toString() },
      {
        $inc: {
          lockedUcoins: -transaction.amount, // Decrease locked
          withdrawableUcoins: transaction.amount, // Increase withdrawable
        },
      },
      { session, new: true }
    );

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    // Validate wallet integrity
    if (wallet.lockedUcoins < 0) {
      throw new Error(
        `Wallet locked balance went negative: ${wallet.lockedUcoins}`
      );
    }

    // Update transaction status
    transaction.status = "unlocked";
    transaction.unlockedAt = new Date();
    transaction.unlockedBy = unlockedBy;
    await transaction.save({ session });

    await session.commitTransaction();

    console.log(
      `✅ Unlocked ${transaction.amount} U-coins for user ${transaction.userId}`
    );

    return {
      success: true,
      transactionId: transaction._id,
      amount: transaction.amount,
      wallet: {
        locked: wallet.lockedUcoins,
        withdrawable: wallet.withdrawableUcoins,
        total: wallet.ucoins,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    console.error("Error unlocking transaction:", error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * 🔒 Re-lock funds (for fraud/dispute cases)
 * @param {ObjectId} transactionId - Transaction to re-lock
 * @param {String} reason - Admin reason for re-locking
 */
async function relockTransaction(transactionId, reason) {
  const session = await Transaction.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findById(transactionId).session(
      session
    );

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status !== "unlocked") {
      throw new Error("Can only re-lock unlocked transactions");
    }

    // Update wallet: move withdrawable → locked
    const wallet = await Wallet.findOneAndUpdate(
      { userId: transaction.userId.toString() },
      {
        $inc: {
          withdrawableUcoins: -transaction.amount, // Decrease withdrawable
          lockedUcoins: transaction.amount, // Increase locked
        },
      },
      { session, new: true }
    );

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    // Validate wallet integrity
    if (wallet.withdrawableUcoins < 0) {
      throw new Error(
        `Wallet withdrawable balance went negative: ${wallet.withdrawableUcoins}`
      );
    }

    // Update transaction status
    transaction.status = "locked";
    transaction.unlockedAt = null;
    transaction.unlockedBy = null;
    if (!transaction.meta) transaction.meta = {};
    transaction.meta.relockReason = reason;
    transaction.meta.relockedAt = new Date();
    await transaction.save({ session });

    await session.commitTransaction();

    console.log(
      `🔒 Re-locked ${transaction.amount} U-coins for user ${transaction.userId}`
    );

    return {
      success: true,
      transactionId: transaction._id,
      amount: transaction.amount,
      wallet: {
        locked: wallet.lockedUcoins,
        withdrawable: wallet.withdrawableUcoins,
        total: wallet.ucoins,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    console.error("Error re-locking transaction:", error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Get wallet lock status for a user
 * @param {String} userId - User ID
 */
async function getWalletLockStatus(userId) {
  try {
    const wallet = await Wallet.findOne({ userId }).lean();

    if (!wallet) {
      return {
        userId,
        exists: false,
        locked: 0,
        withdrawable: 0,
        total: 0,
      };
    }

    // Get locked transactions
    const lockedTransactions = await Transaction.find({
      userId,
      status: "locked",
      type: "salary",
    })
      .sort({ lockedUntil: 1 })
      .lean();

    return {
      userId,
      exists: true,
      locked: wallet.lockedUcoins || 0,
      withdrawable: wallet.withdrawableUcoins || 0,
      total: wallet.ucoins || 0,
      lockedTransactions: lockedTransactions.map((t) => ({
        transactionId: t._id,
        amount: t.amount,
        lockedUntil: t.lockedUntil,
        daysRemaining: Math.ceil(
          (new Date(t.lockedUntil) - new Date()) / (1000 * 60 * 60 * 24)
        ),
      })),
    };
  } catch (error) {
    console.error("Error getting wallet lock status:", error);
    throw error;
  }
}

/**
 * Check for wallet anomalies and create alerts
 * Called after unlock process
 */
async function checkWalletAnomalies() {
  try {
    // Non-blocking: errors don't interrupt unlock process

    // Check 1: Wallet mismatch (balance ≠ sum of transactions)
    await alertService.detectWalletMismatch();
  } catch (err) {
    console.error("Wallet anomaly check failed:", err.message);
  }
}

module.exports = {
  unlockEligibleFunds,
  unlockTransaction,
  relockTransaction,
  getWalletLockStatus,
  checkWalletAnomalies,
};
