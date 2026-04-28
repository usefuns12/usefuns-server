const models = require("../models");
const HostSalaryCycle = models.HostSalaryCycle;
const AgencyCommissionCycle = models.AgencyCommissionCycle;
const Wallet = models.Wallet;
const Transaction = models.Transaction;
const Host = models.Host;
const { calculateHostSalary } = require("../services/hostSalary.service");
const {
  calculateAgencyCommission,
} = require("../services/agencyCommission.service");
const {
  unlockTransaction,
  relockTransaction,
  getWalletLockStatus,
} = require("../services/walletUnlock.service");

/**
 * Recalculate a salary cycle
 * POST /admin/salary-cycles/:id/recalculate
 * Body: { reason, diamondAdjustment, hourAdjustment }
 */
exports.recalculateSalaryCycle = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, diamondAdjustment = 0, hourAdjustment = 0 } = req.body;
    const adminId = req.user._id;

    const cycle = await HostSalaryCycle.findById(id).populate("hostId");

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found",
      });
    }

    if (cycle.status === "paid") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot recalculate already paid cycle. Reverse transaction first.",
      });
    }

    const oldAmount = cycle.salaryUcoins;

    // Apply adjustments
    const newTotalDiamonds = cycle.totalDiamonds + diamondAdjustment;
    const newTotalHours = cycle.totalHostHours + hourAdjustment;

    // Recalculate with new values
    const recalculated = await calculateHostSalary({
      hostId: cycle.hostId._id,
      agencyId: cycle.agencyId,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      totalDiamonds: newTotalDiamonds,
      totalHours: newTotalHours,
    });

    // Store recalculation history
    cycle.recalculationHistory = cycle.recalculationHistory || [];
    cycle.recalculationHistory.push({
      timestamp: new Date(),
      adminId,
      reason,
      oldAmount,
      newAmount: recalculated.salaryUcoins,
      changes: {
        diamondAdjustment,
        hourAdjustment,
        oldDiamonds: cycle.totalDiamonds,
        newDiamonds: newTotalDiamonds,
        oldHours: cycle.totalHostHours,
        newHours: newTotalHours,
      },
    });

    // Update cycle
    cycle.totalDiamonds = newTotalDiamonds;
    cycle.validDiamonds = newTotalDiamonds; // Assuming all adjusted diamonds are valid
    cycle.totalHostHours = newTotalHours;
    cycle.salaryPercentage = recalculated.salaryPercentage;
    cycle.salaryUcoins = recalculated.salaryUcoins;
    cycle.policySnapshot = recalculated.policySnapshot;
    cycle.recalculatedAt = new Date();
    cycle.recalculatedBy = adminId;
    cycle.recalculationReason = reason;

    await cycle.save();

    res.json({
      success: true,
      message: "Salary cycle recalculated successfully",
      data: {
        cycleId: cycle._id,
        oldAmount,
        newAmount: recalculated.salaryUcoins,
        difference: recalculated.salaryUcoins - oldAmount,
        adjustments: {
          diamonds: diamondAdjustment,
          hours: hourAdjustment,
        },
      },
    });
  } catch (error) {
    console.error("Error recalculating salary cycle:", error);
    res.status(500).json({
      success: false,
      message: "Failed to recalculate salary cycle",
      error: error.message,
    });
  }
};

/**
 * Hold a salary cycle (prevent payout)
 * POST /admin/salary-cycles/:id/hold
 * Body: { reason }
 */
exports.holdSalaryCycle = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const cycle = await HostSalaryCycle.findById(id);

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found",
      });
    }

    if (cycle.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Cannot hold already paid cycle",
      });
    }

    if (cycle.status === "held") {
      return res.status(400).json({
        success: false,
        message: "Cycle is already held",
      });
    }

    cycle.status = "held";
    cycle.heldAt = new Date();
    cycle.heldBy = adminId;
    cycle.holdReason = reason;

    await cycle.save();

    res.json({
      success: true,
      message: "Salary cycle held successfully",
      data: {
        cycleId: cycle._id,
        status: cycle.status,
        reason,
      },
    });
  } catch (error) {
    console.error("Error holding salary cycle:", error);
    res.status(500).json({
      success: false,
      message: "Failed to hold salary cycle",
      error: error.message,
    });
  }
};

/**
 * Release a held salary cycle
 * POST /admin/salary-cycles/:id/release
 * Body: { reason }
 */
exports.releaseSalaryCycle = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const cycle = await HostSalaryCycle.findById(id);

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found",
      });
    }

    if (cycle.status !== "held") {
      return res.status(400).json({
        success: false,
        message: "Cycle is not held",
      });
    }

    cycle.status = "calculated"; // Return to calculated state
    cycle.releasedAt = new Date();
    cycle.releasedBy = adminId;

    await cycle.save();

    res.json({
      success: true,
      message: "Salary cycle released successfully",
      data: {
        cycleId: cycle._id,
        status: cycle.status,
      },
    });
  } catch (error) {
    console.error("Error releasing salary cycle:", error);
    res.status(500).json({
      success: false,
      message: "Failed to release salary cycle",
      error: error.message,
    });
  }
};

/**
 * Force payout of a salary cycle (skip waiting period)
 * POST /admin/salary-cycles/:id/force-payout
 * Body: { reason }
 */
exports.forcePayoutSalaryCycle = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const cycle = await HostSalaryCycle.findById(id).populate("hostId");

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found",
      });
    }

    if (cycle.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Cycle already paid",
      });
    }

    if (cycle.status === "held") {
      return res.status(400).json({
        success: false,
        message: "Cannot force payout on held cycle. Release it first.",
      });
    }

    if (cycle.salaryUcoins <= 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot payout zero salary",
      });
    }

    // Get userId from host's customerRef
    const userId = cycle.hostId.customerRef.toString();

    // Credit wallet
    const wallet = await Wallet.findOneAndUpdate(
      { userId },
      {
        $inc: { ucoins: cycle.salaryUcoins },
        $setOnInsert: { userId, diamonds: 0, beans: 0 },
      },
      { upsert: true, new: true }
    );

    // Create transaction
    const transaction = await Transaction.create({
      userId,
      type: "salary",
      token: "ucoin",
      amount: cycle.salaryUcoins,
      source: "host_salary_force_payout",
      status: "success",
      meta: {
        cycleId: cycle._id,
        hostId: cycle.hostId._id,
        forcedBy: adminId,
        reason,
        cycleStart: cycle.cycleStart,
        cycleEnd: cycle.cycleEnd,
      },
    });

    // Update cycle status
    cycle.status = "paid";
    await cycle.save();

    res.json({
      success: true,
      message: "Salary payout forced successfully",
      data: {
        cycleId: cycle._id,
        amount: cycle.salaryUcoins,
        walletBalance: wallet.ucoins,
        transactionId: transaction._id,
      },
    });
  } catch (error) {
    console.error("Error forcing salary payout:", error);
    res.status(500).json({
      success: false,
      message: "Failed to force salary payout",
      error: error.message,
    });
  }
};

/**
 * Reverse a salary payment (deduct from wallet)
 * POST /admin/salary-cycles/:id/reverse
 * Body: { reason }
 */
exports.reverseSalaryPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const cycle = await HostSalaryCycle.findById(id).populate("hostId");

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found",
      });
    }

    if (cycle.status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Can only reverse paid cycles",
      });
    }

    const userId = cycle.hostId.customerRef.toString();

    // 🔒 STEP 3: Check wallet balance (locked + withdrawable)
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.ucoins < cycle.salaryUcoins) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance to reverse transaction",
      });
    }

    // 🔒 Find original salary transaction
    const originalTransaction = await Transaction.findOne({
      userId,
      type: "salary",
      "meta.cycleId": cycle._id,
    });

    // 🔒 Smart deduction: prioritize withdrawable, then locked
    let deductFromWithdrawable = 0;
    let deductFromLocked = 0;

    if (wallet.withdrawableUcoins >= cycle.salaryUcoins) {
      // Case 1: All funds are withdrawable (already unlocked)
      deductFromWithdrawable = cycle.salaryUcoins;
    } else {
      // Case 2: Split between withdrawable and locked
      deductFromWithdrawable = wallet.withdrawableUcoins || 0;
      deductFromLocked = cycle.salaryUcoins - deductFromWithdrawable;
    }

    // 🔒 Deduct from wallet (total + locked/withdrawable)
    wallet.ucoins -= cycle.salaryUcoins;
    wallet.withdrawableUcoins -= deductFromWithdrawable;
    wallet.lockedUcoins -= deductFromLocked;
    await wallet.save();

    // Create reversal transaction
    const transaction = await Transaction.create({
      userId,
      type: "salary_reversal",
      token: "ucoin",
      amount: -cycle.salaryUcoins, // Negative amount
      source: "admin_reversal",
      status: "success",
      meta: {
        cycleId: cycle._id,
        hostId: cycle.hostId._id,
        reversedBy: adminId,
        reason,
        originalAmount: cycle.salaryUcoins,
        deductedFrom: {
          withdrawable: deductFromWithdrawable,
          locked: deductFromLocked,
        },
      },
    });

    // Update cycle status
    cycle.status = "disputed";
    await cycle.save();

    res.json({
      success: true,
      message: "Salary payment reversed successfully",
      data: {
        cycleId: cycle._id,
        reversedAmount: cycle.salaryUcoins,
        walletBalance: wallet.ucoins,
        transactionId: transaction._id,
      },
    });
  } catch (error) {
    console.error("Error reversing salary payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reverse salary payment",
      error: error.message,
    });
  }
};

/**
 * 🔓 Manually unlock salary funds (admin override)
 * POST /admin/transactions/:id/unlock
 * Body: { reason }
 */
exports.unlockFunds = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason required for manual unlock",
      });
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.status !== "locked") {
      return res.status(400).json({
        success: false,
        message: `Transaction is ${transaction.status}, not locked`,
      });
    }

    // Unlock the transaction
    const result = await unlockTransaction(id, "admin");

    // Log admin action
    transaction.meta = transaction.meta || {};
    transaction.meta.adminUnlock = {
      adminId,
      reason,
      timestamp: new Date(),
    };
    await transaction.save();

    res.json({
      success: true,
      message: "Funds unlocked successfully",
      data: {
        transactionId: id,
        amount: result.amount,
        wallet: result.wallet,
        reason,
      },
    });
  } catch (error) {
    console.error("Error unlocking funds:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unlock funds",
      error: error.message,
    });
  }
};

/**
 * 🔒 Re-lock salary funds (fraud/dispute cases)
 * POST /admin/transactions/:id/relock
 * Body: { reason }
 */
exports.relockFunds = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason required for re-locking funds",
      });
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.status !== "unlocked") {
      return res.status(400).json({
        success: false,
        message: `Transaction is ${transaction.status}, not unlocked`,
      });
    }

    // Re-lock the transaction
    const result = await relockTransaction(id, reason);

    // Log admin action
    transaction.meta = transaction.meta || {};
    transaction.meta.adminRelock = {
      adminId,
      reason,
      timestamp: new Date(),
    };
    await transaction.save();

    res.json({
      success: true,
      message: "Funds re-locked successfully",
      data: {
        transactionId: id,
        amount: result.amount,
        wallet: result.wallet,
        reason,
      },
    });
  } catch (error) {
    console.error("Error re-locking funds:", error);
    res.status(500).json({
      success: false,
      message: "Failed to re-lock funds",
      error: error.message,
    });
  }
};

/**
 * Get wallet lock status for a user
 * GET /admin/wallet-lock-status/:userId
 */
exports.getWalletLockStatusAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    const status = await getWalletLockStatus(userId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting wallet lock status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get wallet lock status",
      error: error.message,
    });
  }
};
