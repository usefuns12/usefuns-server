const fraudEngine = require("../services/fraudEngine.service");
const logger = require("../classes/logger");

/**
 * STEP 6.3 - Enforcement Hooks
 *
 * Lightweight checks that:
 * 1. Never crash the main flow
 * 2. Provide clear error messages
 * 3. Log audit trails
 * 4. Return early if fraud action found
 */

/**
 * Check if user has a gift block
 * Throws error if blocked, returns null if not blocked
 * @param {String} userId - The user ID
 * @returns {Promise<Object|null>} - FraudAction if blocked, null if not blocked
 */
async function checkGiftBlock(userId) {
  try {
    const fraudAction = await fraudEngine.hasActiveFraudAction(
      "user",
      userId,
      "gift_block"
    );

    if (fraudAction) {
      const expiresAtStr = fraudAction.expiresAt
        ? fraudAction.expiresAt.toLocaleString()
        : "No expiry (permanent)";

      const error = new Error(
        `Gift blocked: ${fraudAction.reason}. Expires: ${expiresAtStr}`
      );
      error.code = "GIFT_BLOCKED";
      error.fraudAction = fraudAction._id;
      throw error;
    }

    return null;
  } catch (error) {
    // Re-throw with proper error code
    if (error.code === "GIFT_BLOCKED") {
      throw error;
    }

    // Unexpected error - log but don't block
    logger.error(
      `[FraudEnforcement] Error checking gift block: ${error.message}`
    );
    return null;
  }
}

/**
 * Check if user has a withdrawal block
 * @param {String} userId - The user ID
 * @returns {Promise<Object|null>} - FraudAction if blocked, null if not blocked
 */
async function checkWithdrawalBlock(userId) {
  try {
    const fraudAction = await fraudEngine.hasActiveFraudAction(
      "user",
      userId,
      "withdrawal_block"
    );

    if (fraudAction) {
      const expiresAtStr = fraudAction.expiresAt
        ? fraudAction.expiresAt.toLocaleString()
        : "No expiry (permanent)";

      const error = new Error(
        `Withdrawal blocked: ${fraudAction.reason}. Expires: ${expiresAtStr}`
      );
      error.code = "WITHDRAWAL_BLOCKED";
      error.fraudAction = fraudAction._id;
      throw error;
    }

    return null;
  } catch (error) {
    if (error.code === "WITHDRAWAL_BLOCKED") {
      throw error;
    }

    logger.error(
      `[FraudEnforcement] Error checking withdrawal block: ${error.message}`
    );
    return null;
  }
}

/**
 * Check if wallet has a freeze
 * @param {String} walletId - The wallet ID
 * @returns {Promise<Object|null>} - FraudAction if frozen, null if not frozen
 */
async function checkWalletFreeze(walletId) {
  try {
    const fraudAction = await fraudEngine.hasActiveFraudAction(
      "wallet",
      walletId,
      "wallet_freeze"
    );

    if (fraudAction) {
      const error = new Error(
        `Wallet frozen: ${fraudAction.reason}. Manual admin review required.`
      );
      error.code = "WALLET_FROZEN";
      error.fraudAction = fraudAction._id;
      throw error;
    }

    return null;
  } catch (error) {
    if (error.code === "WALLET_FROZEN") {
      throw error;
    }

    logger.error(
      `[FraudEnforcement] Error checking wallet freeze: ${error.message}`
    );
    return null;
  }
}

/**
 * Check if host has a suspension
 * @param {String} hostId - The host ID
 * @returns {Promise<Object|null>} - FraudAction if suspended, null if not suspended
 */
async function checkHostSuspension(hostId) {
  try {
    const fraudAction = await fraudEngine.hasActiveFraudAction(
      "host",
      hostId,
      "host_suspend"
    );

    if (fraudAction) {
      const expiresAtStr = fraudAction.expiresAt
        ? fraudAction.expiresAt.toLocaleString()
        : "No expiry (permanent)";

      const error = new Error(
        `Host suspended: ${fraudAction.reason}. Expires: ${expiresAtStr}`
      );
      error.code = "HOST_SUSPENDED";
      error.fraudAction = fraudAction._id;
      throw error;
    }

    return null;
  } catch (error) {
    if (error.code === "HOST_SUSPENDED") {
      throw error;
    }

    logger.error(
      `[FraudEnforcement] Error checking host suspension: ${error.message}`
    );
    return null;
  }
}

/**
 * Check if device is banned
 * @param {String} deviceFingerprint - Device identifier
 * @returns {Promise<Object|null>} - FraudAction if banned, null if not banned
 */
async function checkDeviceBan(deviceFingerprint) {
  try {
    const fraudAction = await fraudEngine.hasActiveFraudAction(
      "device",
      deviceFingerprint,
      "device_ban"
    );

    if (fraudAction) {
      const error = new Error(
        `Device banned: ${fraudAction.reason}. This device is not permitted to access UseFuns.`
      );
      error.code = "DEVICE_BANNED";
      error.fraudAction = fraudAction._id;
      throw error;
    }

    return null;
  } catch (error) {
    if (error.code === "DEVICE_BANNED") {
      throw error;
    }

    logger.error(
      `[FraudEnforcement] Error checking device ban: ${error.message}`
    );
    return null;
  }
}

/**
 * Get all active blocks for a user (for UI display)
 * @param {String} userId - The user ID
 * @returns {Promise<Array>} - Array of active FraudActions
 */
async function getUserFraudActions(userId) {
  try {
    return await fraudEngine.getActiveFraudActions("user", userId);
  } catch (error) {
    logger.error(
      `[FraudEnforcement] Error getting user fraud actions: ${error.message}`
    );
    return [];
  }
}

/**
 * Get all active blocks for a host (for UI display)
 * @param {String} hostId - The host ID
 * @returns {Promise<Array>} - Array of active FraudActions
 */
async function getHostFraudActions(hostId) {
  try {
    return await fraudEngine.getActiveFraudActions("host", hostId);
  } catch (error) {
    logger.error(
      `[FraudEnforcement] Error getting host fraud actions: ${error.message}`
    );
    return [];
  }
}

module.exports = {
  // Check functions (throw if blocked)
  checkGiftBlock,
  checkWithdrawalBlock,
  checkWalletFreeze,
  checkHostSuspension,
  checkDeviceBan,

  // Query functions (don't throw)
  getUserFraudActions,
  getHostFraudActions,
};
