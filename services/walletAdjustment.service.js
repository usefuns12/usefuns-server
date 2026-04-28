const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const HostSalaryCycle = require("../models/HostSalaryCycle");

/**
 * 💰 STEP 4: Wallet-Safe Adjustment Logic
 *
 * Handles salary/commission adjustments safely:
 * - Never deletes transactions
 * - Always creates adjustment transactions
 * - Respects lock periods
 * - Handles negative balances gracefully
 */

/**
 * Apply a salary adjustment
 * @param {String} userId - User ID
 * @param {Number} adjustmentAmount - Amount to adjust (+/-)
 * @param {String} reason - Why adjustment is being made
 * @param {String} disputeId - Reference to dispute
 * @param {String} originalTransactionId - Transaction being adjusted
 */
async function applySalaryAdjustment(
  userId,
  adjustmentAmount,
  reason,
  disputeId,
  originalTransactionId
) {
  const session = await Wallet.startSession();
  session.startTransaction();

  try {
    if (adjustmentAmount === 0) {
      throw new Error("Adjustment amount cannot be zero");
    }

    console.log(`
    💰 Applying salary adjustment:
    User: ${userId}
    Amount: ${adjustmentAmount} U-coins
    Reason: ${reason}
    `);

    // Get current wallet
    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const oldBalance = wallet.ucoins || 0;
    const oldLocked = wallet.lockedUcoins || 0;
    const oldWithdrawable = wallet.withdrawableUcoins || 0;

    // Determine where to deduct/credit based on cycle status
    let newLocked = oldLocked;
    let newWithdrawable = oldWithdrawable;

    if (adjustmentAmount > 0) {
      // ✅ POSITIVE ADJUSTMENT: Credit locked (new funds follow lock rules)
      newLocked += adjustmentAmount;
    } else {
      // ❌ NEGATIVE ADJUSTMENT: Deduct from available first, then locked
      const absAmount = Math.abs(adjustmentAmount);

      if (newWithdrawable >= absAmount) {
        // Deduct from withdrawable only
        newWithdrawable -= absAmount;
      } else {
        // Split between withdrawable and locked
        newLocked -= absAmount - newWithdrawable;
        newWithdrawable = 0;
      }
    }

    // ⚠️ Handle negative locked balance
    if (newLocked < 0) {
      console.warn(`
      ⚠️ WARNING: Negative locked balance detected
      User: ${userId}
      Old locked: ${oldLocked}
      New locked: ${newLocked}
      
      Possible scenarios:
      1. Host withdrew more than available
      2. Large reversal on already-withdrawn funds
      
      Action: Creating negative balance (hold future earnings)
      `);
      // Keep negative balance - will be offset by future earnings
    }

    // Update wallet
    wallet.ucoins = newLocked + newWithdrawable;
    wallet.lockedUcoins = newLocked;
    wallet.withdrawableUcoins = newWithdrawable;
    await wallet.save({ session });

    // Create adjustment transaction
    const adjustmentTxn = await Transaction.create(
      [
        {
          userId,
          type: "salaryAdjustment",
          token: "ucoin",
          amount: adjustmentAmount,
          source: "dispute_adjustment",
          status: "success",
          adjustmentRef: disputeId,
          adjustmentReason: reason,
          originalTransactionId,
          meta: {
            oldBalance,
            newBalance: wallet.ucoins,
            oldLocked,
            newLocked,
            oldWithdrawable,
            newWithdrawable,
            reason,
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    console.log(`
    ✅ Adjustment applied successfully:
    Old balance: ${oldBalance} → New balance: ${wallet.ucoins}
    Locked: ${oldLocked} → ${newLocked}
    Withdrawable: ${oldWithdrawable} → ${newWithdrawable}
    `);

    return {
      success: true,
      adjustmentTxnId: adjustmentTxn[0]._id,
      wallet: {
        total: wallet.ucoins,
        locked: newLocked,
        withdrawable: newWithdrawable,
      },
      change: {
        oldBalance,
        newBalance: wallet.ucoins,
        delta: adjustmentAmount,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in applySalaryAdjustment:", error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Apply a commission adjustment to agency wallet
 */
async function applyCommissionAdjustment(
  agencyId,
  adjustmentAmount,
  reason,
  disputeId,
  originalTransactionId
) {
  // For now, treat agency the same as user
  // (You may have separate agency wallet model)
  return applySalaryAdjustment(
    agencyId.toString(),
    adjustmentAmount,
    reason,
    disputeId,
    originalTransactionId
  );
}

/**
 * Reverse a withdrawal transaction
 * (Add funds back to wallet)
 */
async function reverseWithdrawal(withdrawalTransactionId, reason, disputeId) {
  const session = await Transaction.startSession();
  session.startTransaction();

  try {
    const withdrawalTxn = await Transaction.findById(
      withdrawalTransactionId
    ).session(session);

    if (!withdrawalTxn) {
      throw new Error("Withdrawal transaction not found");
    }

    if (withdrawalTxn.type !== "withdrawal") {
      throw new Error("Can only reverse withdrawal transactions");
    }

    const userId = withdrawalTxn.userId.toString();
    const refundAmount = withdrawalTxn.amount;

    console.log(`
    💰 Reversing withdrawal:
    User: ${userId}
    Amount: ${refundAmount} U-coins
    Reason: ${reason}
    `);

    // Apply adjustment (credit back to wallet)
    const result = await applySalaryAdjustment(
      userId,
      refundAmount,
      `Withdrawal reversal: ${reason}`,
      disputeId,
      withdrawalTransactionId
    );

    await session.commitTransaction();

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in reverseWithdrawal:", error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Create a reversal transaction (negative amount)
 * Used when original transaction needs to be reversed
 */
async function createReversalTransaction(
  originalTransactionId,
  reason,
  disputeId,
  adminId
) {
  try {
    const originalTxn = await Transaction.findById(originalTransactionId);

    if (!originalTxn) {
      throw new Error("Original transaction not found");
    }

    console.log(`
    🔄 Creating reversal transaction:
    Original ID: ${originalTransactionId}
    Amount: ${originalTxn.amount} U-coins
    Reason: ${reason}
    `);

    // Create negative transaction
    const reversalTxn = await Transaction.create({
      userId: originalTxn.userId,
      type: "reversal",
      token: originalTxn.token,
      amount: -originalTxn.amount, // Negative
      source: "dispute_reversal",
      status: "success",
      adjustmentRef: disputeId,
      adjustmentReason: reason,
      originalTransactionId,
      meta: {
        originalType: originalTxn.type,
        originalAmount: originalTxn.amount,
        reason,
        reversedBy: adminId,
      },
    });

    return {
      success: true,
      reversalTxnId: reversalTxn._id,
      originalTxnId: originalTransactionId,
      amount: originalTxn.amount,
    };
  } catch (error) {
    console.error("Error in createReversalTransaction:", error);
    throw error;
  }
}

module.exports = {
  applySalaryAdjustment,
  applyCommissionAdjustment,
  reverseWithdrawal,
  createReversalTransaction,
};
