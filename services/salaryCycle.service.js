const cron = require("node-cron");
const Host = require("../models/Host");
const HostSalaryCycle = require("../models/HostSalaryCycle");
const Policy = require("../models/Policy");
const HostStat = require("../models/HostStat");
const GiftTransaction = require("../models/GiftTransaction");
const { calculateHostSalary } = require("./hostSalary.service");

/**
 * Daily cron job to manage host salary cycles
 * Runs every day at 00:00 (midnight)
 */
function startSalaryCycleCron() {
  // Run daily at midnight
  cron.schedule("0 0 * * *", async () => {
    console.log("🔄 Running salary cycle check...");
    try {
      await processSalaryCycles();
    } catch (error) {
      console.error("❌ Error in salary cycle cron:", error);
    }
  });

  console.log("✅ Salary cycle cron job started");
}

/**
 * Process salary cycles for all active hosts
 */
async function processSalaryCycles() {
  try {
    const policy = await Policy.findOne({ type: "hostSalary" });
    if (!policy) {
      console.error("❌ Host salary policy not found");
      return;
    }

    const { noDayLimits, minDays, maxDays } = policy.hostSalary;

    // Find all active hosts
    const activeHosts = await Host.find({ status: "active" }).lean();
    console.log(`📊 Found ${activeHosts.length} active hosts`);

    for (const host of activeHosts) {
      await processHostCycle(host._id, host.agencyId, noDayLimits, minDays, maxDays);
    }

    console.log("✅ Salary cycle processing completed");
  } catch (error) {
    console.error("Error processing salary cycles:", error);
    throw error;
  }
}

/**
 * Process salary cycle for a specific host
 */
async function processHostCycle(hostId, agencyId, noDayLimits, minDays, maxDays) {
  try {
    // Check for existing pending cycle
    let cycle = await HostSalaryCycle.findOne({
      hostId,
      status: "pending",
    }).sort({ cycleStart: -1 });

    const now = new Date();

    // If no cycle exists, create new one
    if (!cycle) {
      cycle = await HostSalaryCycle.create({
        hostId,
        agencyId,
        cycleStart: now,
        cycleEnd: null,
        totalDiamonds: 0,
        validDiamonds: 0,
        totalHostHours: 0,
        salaryPercentage: 0,
        salaryUcoins: 0,
        rewardGranted: false,
        status: "pending",
      });
      console.log(`✅ Created new salary cycle for host ${hostId}`);
      return;
    }

    // Check if cycle should be closed
    const cycleAgeMs = now - cycle.cycleStart;
    const cycleAgeDays = cycleAgeMs / (1000 * 60 * 60 * 24);

    // Skip day validation if noDayLimits is true
    if (noDayLimits) {
      // Don't enforce day limits, just return
      return;
    }

    if (cycleAgeDays >= minDays && cycleAgeDays <= maxDays) {
      // Close the cycle
      await closeSalaryCycle(cycle);
    } else if (cycleAgeDays > maxDays) {
      // Force close if exceeded max days
      console.warn(
        `⚠️ Cycle exceeded max days for host ${hostId}, force closing`,
      );
      await closeSalaryCycle(cycle);
    }
  } catch (error) {
    console.error(`Error processing cycle for host ${hostId}:`, error);
  }
}

/**
 * Close a salary cycle and calculate salary
 */
async function closeSalaryCycle(cycle) {
  try {
    const cycleEnd = new Date();
    const host = await Host.findById(cycle.hostId).select("customerRef").lean();

    // Aggregate total hours from HostStat
    const hostStats = await HostStat.find({
      hostId: cycle.hostId,
      date: { $gte: cycle.cycleStart, $lte: cycleEnd },
    });

    let totalHostHours = 0;
    let totalGiftDiamonds = 0;

    hostStats.forEach((stat) => {
      totalHostHours += stat.hostTimeHours || 0;
      totalGiftDiamonds += stat.gifts || 0;
    });

    // Get valid diamonds from GiftTransaction
    const validDiamondsResult = await GiftTransaction.aggregate([
      {
        $match: {
          receiver: host?.customerRef,
          isValidForSalary: true,
          giftTime: { $gte: cycle.cycleStart, $lte: cycleEnd },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalDiamonds" },
        },
      },
    ]);

    const validDiamonds =
      validDiamondsResult.length > 0 ? validDiamondsResult[0].total : 0;

    // Calculate salary using policy
    const salaryResult = await calculateHostSalary({
      hostId: cycle.hostId,
      agencyId: cycle.agencyId,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycleEnd,
      totalDiamonds: validDiamonds,
      totalHours: totalHostHours,
    });

    // Update cycle
    cycle.cycleEnd = cycleEnd;
    cycle.totalDiamonds = totalGiftDiamonds;
    cycle.validDiamonds = validDiamonds;
    cycle.totalHostHours = totalHostHours;
    cycle.salaryPercentage = salaryResult.salaryPercentage;
    cycle.salaryUcoins = salaryResult.salaryUcoins;
    cycle.rewardGranted = salaryResult.rewardGranted;
    cycle.status = "calculated";

    await cycle.save();

    console.log(`✅ Closed salary cycle for host ${cycle.hostId}`);
    console.log(
      `   Hours: ${totalHostHours.toFixed(
        2,
      )}, Valid Diamonds: ${validDiamonds}, Salary: ${
        salaryResult.salaryUcoins
      } U-coins`,
    );

    return cycle;
  } catch (error) {
    console.error("Error closing salary cycle:", error);
    throw error;
  }
}

/**
 * Manual trigger to process cycles (for testing or admin use)
 */
async function manualProcessCycles() {
  console.log("🔄 Manual salary cycle processing triggered");
  await processSalaryCycles();
}

module.exports = {
  startSalaryCycleCron,
  processSalaryCycles,
  closeSalaryCycle,
  manualProcessCycles,
};
