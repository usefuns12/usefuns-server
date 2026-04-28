const Wallet = require("../models/Wallet");
const { getWalletLockStatus } = require("./walletUnlock.service");

/**
 * 🚫 Check if user can withdraw requested amount
 * CRITICAL: Only withdrawableUcoins can be withdrawn, NOT lockedUcoins
 *
 * @param {String} userId - User ID
 * @param {Number} requestedAmount - Amount user wants to withdraw
 * @returns {Object} { eligible, reason, available }
 */
async function checkWithdrawalEligibility(userId, requestedAmount) {
  try {
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return {
        eligible: false,
        reason: "Wallet not found",
        available: 0,
        locked: 0,
      };
    }

    const withdrawable = wallet.withdrawableUcoins || 0;
    const locked = wallet.lockedUcoins || 0;

    // 🚫 CRITICAL CHECK: Only withdrawable funds can be withdrawn
    if (withdrawable < requestedAmount) {
      return {
        eligible: false,
        reason: `Insufficient withdrawable balance. You have ${withdrawable} U-coins available, but ${locked} U-coins are locked pending unlock period.`,
        available: withdrawable,
        locked: locked,
        requested: requestedAmount,
        shortfall: requestedAmount - withdrawable,
      };
    }

    return {
      eligible: true,
      reason: "Withdrawal approved",
      available: withdrawable,
      locked: locked,
      requested: requestedAmount,
    };
  } catch (error) {
    console.error("Error checking withdrawal eligibility:", error);
    throw error;
  }
}

/**
 * Get detailed withdrawal info for user (UI display)
 * @param {String} userId - User ID
 */
async function getWithdrawalInfo(userId) {
  try {
    const lockStatus = await getWalletLockStatus(userId);

    return {
      total: lockStatus.total,
      withdrawable: lockStatus.withdrawable,
      locked: lockStatus.locked,
      message:
        lockStatus.locked > 0
          ? `${lockStatus.locked} U-coins are locked and will be available soon`
          : "All funds are available for withdrawal",
      lockedTransactions: lockStatus.lockedTransactions,
    };
  } catch (error) {
    console.error("Error getting withdrawal info:", error);
    throw error;
  }
}

module.exports = {
  checkWithdrawalEligibility,
  getWithdrawalInfo,
};
