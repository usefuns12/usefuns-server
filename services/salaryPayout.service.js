const HostSalaryCycle = require("../models/HostSalaryCycle");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const Host = require("../models/Host");
const alertService = require("./alert.service");

/**
 * Pay salary to a host for a specific salary cycle
 * @param {ObjectId} cycleId - HostSalaryCycle ID
 */
async function payHostSalary(cycleId) {
  try {
    const cycle = await HostSalaryCycle.findById(cycleId);

    if (!cycle) {
      throw new Error("Salary cycle not found");
    }

    if (cycle.status === "paid") {
      throw new Error("Salary already paid for this cycle");
    }

    if (cycle.status !== "calculated") {
      throw new Error("Salary must be calculated before payment");
    }

    if (cycle.salaryUcoins <= 0) {
      console.log(`⚠️ No salary to pay for host ${cycle.hostId}`);
      cycle.status = "paid";
      await cycle.save();
      return { success: true, amount: 0, message: "No salary earned" };
    }

    // Get host to find customerRef
    const host = await Host.findById(cycle.hostId);
    if (!host) {
      throw new Error("Host not found");
    }

    // Get userId from customerRef (convert ObjectId to string for wallet lookup)
    const userId = host.customerRef.toString();

    // 🔒 STEP 3: Get unlock policy
    const Policy = require("../models/Policy");
    const policy = await Policy.findOne({ type: "hostSalary" });
    const lockDays = policy?.hostSalary?.unlockRules?.lockDays || 3;
    const lockedUntilDate = new Date();
    lockedUntilDate.setDate(lockedUntilDate.getDate() + lockDays);

    // 🔒 Credit LOCKED ucoins (not withdrawable yet)
    const wallet = await Wallet.findOneAndUpdate(
      { userId: userId },
      {
        $inc: {
          ucoins: cycle.salaryUcoins, // Total balance
          lockedUcoins: cycle.salaryUcoins, // Locked portion
        },
        $setOnInsert: {
          userId: userId,
          diamonds: 0,
          beans: 0,
          withdrawableUcoins: 0,
        },
      },
      { upsert: true, new: true }
    );

    // 🔒 Create LOCKED transaction record
    const transaction = await Transaction.create({
      userId: userId,
      type: "salary",
      token: "ucoin",
      amount: cycle.salaryUcoins,
      source: "host_salary",
      status: "locked", // 🔒 LOCKED until unlock period
      lockedUntil: lockedUntilDate,
      meta: {
        cycleId: cycle._id,
        cycleStart: cycle.cycleStart,
        cycleEnd: cycle.cycleEnd,
        validDiamonds: cycle.validDiamonds,
        totalHostHours: cycle.totalHostHours,
        salaryPercentage: cycle.salaryPercentage,
        rewardGranted: cycle.rewardGranted,
        lockDays: lockDays,
      },
    });

    // Mark cycle as paid
    cycle.status = "paid";
    await cycle.save();

    console.log(
      `✅ Paid ${cycle.salaryUcoins} U-coins to host ${cycle.hostId}`
    );

    return {
      success: true,
      amount: cycle.salaryUcoins,
      transaction: transaction._id,
      wallet: wallet,
    };
  } catch (error) {
    console.error("Error paying host salary:", error);
    throw error;
  }
}

/**
 * Pay salaries for all calculated but unpaid cycles
 */
async function payAllPendingSalaries() {
  try {
    const unpaidCycles = await HostSalaryCycle.find({ status: "calculated" });

    console.log(`📊 Found ${unpaidCycles.length} unpaid salary cycles`);

    const results = [];

    for (const cycle of unpaidCycles) {
      try {
        const result = await payHostSalary(cycle._id);
        results.push({ cycleId: cycle._id, success: true, ...result });
      } catch (error) {
        console.error(`❌ Failed to pay cycle ${cycle._id}:`, error.message);
        results.push({
          cycleId: cycle._id,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(`✅ Processed ${results.length} salary payments`);

    return results;
  } catch (error) {
    console.error("Error paying pending salaries:", error);
    throw error;
  }
}

/**
 * Get salary payment details for a host
 * @param {ObjectId} hostId - The host's ID
 * @param {Number} limit - Number of recent payments to retrieve
 */
async function getHostSalaryHistory(hostId, limit = 10) {
  try {
    const cycles = await HostSalaryCycle.find({ hostId })
      .sort({ cycleEnd: -1 })
      .limit(limit)
      .lean();

    return cycles;
  } catch (error) {
    console.error("Error getting host salary history:", error);
    throw error;
  }
}

module.exports = {
  payHostSalary,
  payAllPendingSalaries,
  getHostSalaryHistory,
  checkSalaryStuckCycles: async function () {
    // Check for cycles stuck in pending > 24 hours
    try {
      await alertService.detectStuckCycle();
    } catch (err) {
      console.error("Error checking stuck cycles:", err.message);
    }
  },
};
