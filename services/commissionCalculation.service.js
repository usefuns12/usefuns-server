const HostSalaryCycle = require("../models/HostSalaryCycle");
const AgencyCommissionCycle = require("../models/AgencyCommissionCycle");
const Policy = require("../models/Policy");
const { calculateAgencyCommission } = require("./agencyCommission.service");

/**
 * Calculate agency commission for a specific period
 * @param {ObjectId} agencyId - The agency's ID
 * @param {Date} cycleStart - Start date of commission period
 * @param {Date} cycleEnd - End date of commission period
 */
async function calculateAgencyCommissionCycle(agencyId, cycleStart, cycleEnd) {
  try {
    // Get policy
    const policy = await Policy.findOne({ type: "agencyCommission" });
    if (!policy) {
      throw new Error("Agency commission policy not configured");
    }

    // Sum all paid host salaries for this agency in the period
    const salaryCycles = await HostSalaryCycle.find({
      agencyId: agencyId,
      status: "paid",
      validDiamonds: { $gt: 0 },
      cycleEnd: { $gte: cycleStart, $lte: cycleEnd },
    });

    const totalHostSalaryUcoins = salaryCycles.reduce(
      (sum, cycle) => sum + (cycle.salaryUcoins || 0),
      0,
    );

    // Calculate commission using slabs
    const { percentage, commissionUcoins, policySnapshot } =
      await calculateAgencyCommission(totalHostSalaryUcoins);

    // Check if commission cycle already exists
    let commissionCycle = await AgencyCommissionCycle.findOne({
      agencyId,
      cycleStart,
      cycleEnd,
    });

    if (commissionCycle) {
      // Update existing
      commissionCycle.totalHostSalaryUcoins = totalHostSalaryUcoins;
      commissionCycle.commissionPercentage = percentage;
      commissionCycle.commissionUcoins = commissionUcoins;
      commissionCycle.policySnapshot = policySnapshot;
      commissionCycle.status = "calculated";
      await commissionCycle.save();
    } else {
      // Create new
      commissionCycle = await AgencyCommissionCycle.create({
        agencyId,
        cycleStart,
        cycleEnd,
        totalHostSalaryUcoins,
        commissionPercentage: percentage,
        commissionUcoins,
        policySnapshot,
        status: "calculated",
      });
    }

    console.log(`✅ Calculated commission for agency ${agencyId}`);
    console.log(`   Total Host Salaries: ${totalHostSalaryUcoins} U-coins`);
    console.log(`   Commission: ${commissionUcoins} U-coins (${percentage}%)`);

    return commissionCycle;
  } catch (error) {
    console.error("Error calculating agency commission:", error);
    throw error;
  }
}

/**
 * Calculate commissions for all agencies for a given period
 * @param {Date} cycleStart - Start date of commission period
 * @param {Date} cycleEnd - End date of commission period
 */
async function calculateAllAgencyCommissions(cycleStart, cycleEnd) {
  try {
    // Find all agencies that have paid host salaries in this period
    const agencyIds = await HostSalaryCycle.distinct("agencyId", {
      status: "paid",
      validDiamonds: { $gt: 0 },
      cycleEnd: { $gte: cycleStart, $lte: cycleEnd },
      agencyId: { $exists: true, $ne: null },
    });

    console.log(
      `📊 Found ${agencyIds.length} agencies with paid host salaries`,
    );

    const results = [];

    for (const agencyId of agencyIds) {
      try {
        const commission = await calculateAgencyCommissionCycle(
          agencyId,
          cycleStart,
          cycleEnd,
        );
        results.push({ agencyId, success: true, commission });
      } catch (error) {
        console.error(
          `❌ Failed to calculate commission for agency ${agencyId}:`,
          error.message,
        );
        results.push({ agencyId, success: false, error: error.message });
      }
    }

    console.log(`✅ Calculated ${results.length} agency commissions`);

    return results;
  } catch (error) {
    console.error("Error calculating all agency commissions:", error);
    throw error;
  }
}

/**
 * Get monthly commission period dates
 * @param {Date} date - Reference date (defaults to current date)
 */
function getMonthlyCommissionPeriod(date = new Date()) {
  const cycleStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const cycleEnd = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  return { cycleStart, cycleEnd };
}

/**
 * Calculate commissions for current month
 */
async function calculateCurrentMonthCommissions() {
  const { cycleStart, cycleEnd } = getMonthlyCommissionPeriod();

  console.log(
    `🔄 Calculating commissions for period: ${cycleStart.toISOString()} to ${cycleEnd.toISOString()}`,
  );

  return await calculateAllAgencyCommissions(cycleStart, cycleEnd);
}

module.exports = {
  calculateAgencyCommissionCycle,
  calculateAllAgencyCommissions,
  calculateCurrentMonthCommissions,
  getMonthlyCommissionPeriod,
};
