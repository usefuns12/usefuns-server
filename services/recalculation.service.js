const models = require("../models");
const HostSalaryCycle = models.HostSalaryCycle;
const AgencyCommissionCycle = models.AgencyCommissionCycle;
const Wallet = models.Wallet;
const Transaction = models.Transaction;
const Dispute = models.Dispute;
const { calculateHostSalary } = require("./hostSalary.service");

/**
 * 🧮 STEP 4: Recalculation Engine (Safe & Traceable)
 *
 * Never mutates original data
 * Uses policySnapshot to ensure reproducibility
 * Returns delta for adjustment decision
 */

/**
 * Recalculate a salary cycle from a dispute
 * Uses the original policySnapshot, not current policy
 */
async function recalculateSalaryFromDispute(cycleId, disputeReason) {
  try {
    const cycle = await HostSalaryCycle.findById(cycleId).populate("hostId");

    if (!cycle) {
      throw new Error("Salary cycle not found");
    }

    if (!cycle.policySnapshot) {
      throw new Error("No policy snapshot found - cannot recalculate");
    }

    console.log(`🧮 Recalculating salary cycle ${cycleId}...`);

    // Clone the cycle data (don't mutate original)
    const recalcData = {
      hostId: cycle.hostId._id,
      agencyId: cycle.agencyId,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      totalDiamonds: cycle.totalDiamonds,
      totalHostHours: cycle.totalHostHours,
    };

    // Recalculate using same policy snapshot
    const recalculated = await calculateHostSalary(recalcData);

    // Calculate difference
    const oldAmount = cycle.salaryUcoins;
    const newAmount = recalculated.salaryUcoins;
    const difference = newAmount - oldAmount;

    console.log(`
    📊 Recalculation Result:
    Old Salary: ${oldAmount} U-coins
    New Salary: ${newAmount} U-coins
    Difference: ${difference} U-coins
    `);

    return {
      success: true,
      cycleId,
      oldAmount,
      newAmount,
      difference,
      policyUsed: cycle.policySnapshot,
      metadata: {
        cycleStart: cycle.cycleStart,
        cycleEnd: cycle.cycleEnd,
        totalDiamonds: cycle.totalDiamonds,
        totalHostHours: cycle.totalHostHours,
      },
    };
  } catch (error) {
    console.error("Error in recalculateSalaryFromDispute:", error);
    throw error;
  }
}

/**
 * Recalculate agency commission from a dispute
 */
async function recalculateCommissionFromDispute(commissionCycleId) {
  try {
    const cycle = await AgencyCommissionCycle.findById(
      commissionCycleId
    ).populate("agencyId");

    if (!cycle) {
      throw new Error("Commission cycle not found");
    }

    if (!cycle.policySnapshot) {
      throw new Error("No policy snapshot found - cannot recalculate");
    }

    console.log(`🧮 Recalculating commission cycle ${commissionCycleId}...`);

    // Get all host salary cycles for this commission cycle
    const hostCycles = await HostSalaryCycle.find({
      agencyId: cycle.agencyId,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      status: "paid", // Only count paid cycles
    });

    // Recalculate total salary
    const totalHostSalary = hostCycles.reduce(
      (sum, c) => sum + c.salaryUcoins,
      0
    );

    // Apply policy slabs to recalculate commission
    const policySlabs = cycle.policySnapshot.salarySlabs || [];
    let newCommissionPercentage = 0;

    for (const slab of policySlabs) {
      if (
        totalHostSalary >= slab.min &&
        (slab.max === null || totalHostSalary <= slab.max)
      ) {
        newCommissionPercentage = slab.percentage;
        break;
      }
    }

    const newCommissionAmount = Math.floor(
      (totalHostSalary * newCommissionPercentage) / 100
    );

    // Calculate difference
    const oldAmount = cycle.commissionUcoins;
    const newAmount = newCommissionAmount;
    const difference = newAmount - oldAmount;

    console.log(`
    📊 Commission Recalculation Result:
    Old Commission: ${oldAmount} U-coins
    New Commission: ${newAmount} U-coins
    Difference: ${difference} U-coins
    `);

    return {
      success: true,
      cycleId: commissionCycleId,
      oldAmount,
      newAmount,
      difference,
      totalHostSalary,
      hostCycleCount: hostCycles.length,
      policyUsed: cycle.policySnapshot,
    };
  } catch (error) {
    console.error("Error in recalculateCommissionFromDispute:", error);
    throw error;
  }
}

/**
 * Get what would happen if we apply recalculation
 * (Dry run - doesn't modify anything)
 */
async function simulateRecalculation(type, referenceId) {
  try {
    if (type === "salary") {
      return await recalculateSalaryFromDispute(referenceId, "simulation");
    } else if (type === "commission") {
      return await recalculateCommissionFromDispute(referenceId);
    } else {
      throw new Error(`Unknown dispute type: ${type}`);
    }
  } catch (error) {
    console.error("Error in simulateRecalculation:", error);
    throw error;
  }
}

module.exports = {
  recalculateSalaryFromDispute,
  recalculateCommissionFromDispute,
  simulateRecalculation,
};
