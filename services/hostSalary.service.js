const Policy = require("../models/Policy");
const HostSalaryCycle = require("../models/HostSalaryCycle");
const alertService = require("./alert.service");

async function calculateHostSalary({
  hostId,
  agencyId,
  cycleStart,
  cycleEnd,
  totalDiamonds,
  totalHours,
}) {
  const policy = await Policy.findOne({ type: "hostSalary" });

  if (!policy) throw new Error("Host salary policy not configured");

  // Create policy snapshot (immutable)
  const policySnapshot = {
    policyId: policy._id,
    version: policy.version || 1,
    appliedAt: new Date(),
    diamondTarget: policy.hostSalary.diamondTarget,
    hourSlabs: policy.hostSalary.hourSlabs,
    reward: policy.hostSalary.reward,
  };

  if (totalDiamonds < policy.hostSalary.diamondTarget) {
    return {
      salaryPercentage: 0,
      salaryUcoins: 0,
      rewardGranted: false,
      policySnapshot, // Include snapshot even for zero salary
    };
  }

  let percentage = 0;

  for (const slab of policy.hostSalary.hourSlabs) {
    if (totalHours >= slab.minHours) {
      percentage = slab.percentage;
    }
  }

  const salaryUcoins = Math.floor((totalDiamonds * percentage) / 100);

  return {
    salaryPercentage: percentage,
    salaryUcoins,
    rewardGranted: percentage === 100 && policy.hostSalary.reward.enabled,
    policySnapshot, // Include snapshot for audit trail
  };
}

/**
 * Check for salary anomalies and create alerts
 * Called after salary is calculated
 */
async function checkHostSalaryAnomalies({
  hostId,
  currentCycle,
  previousCycle,
}) {
  try {
    // Non-blocking: errors don't interrupt salary calculation

    // Check 1: Zero salary in 2+ consecutive cycles
    if (
      currentCycle.salaryUcoins === 0 &&
      previousCycle &&
      previousCycle.salaryUcoins === 0
    ) {
      await alertService.createAlert({
        type: "salary_zero",
        severity: "high",
        referenceType: "host",
        referenceId: hostId,
        message: `Host has 0 salary for 2 consecutive cycles (${previousCycle._id}, ${currentCycle._id})`,
        meta: {
          cycles: [
            {
              id: previousCycle._id,
              period: `${previousCycle.startDate} to ${previousCycle.endDate}`,
              amount: 0,
            },
            {
              id: currentCycle._id,
              period: `${currentCycle.startDate} to ${currentCycle.endDate}`,
              amount: 0,
            },
          ],
        },
        deduplicationKey: `salary_zero_${hostId}`,
      });
    }

    // Check 2: Salary drop > 40%
    if (
      previousCycle &&
      previousCycle.salaryUcoins > 0 &&
      currentCycle.salaryUcoins > 0
    ) {
      const dropPercent =
        ((previousCycle.salaryUcoins - currentCycle.salaryUcoins) /
          previousCycle.salaryUcoins) *
        100;

      if (dropPercent > 40) {
        await alertService.createAlert({
          type: "salary_drop",
          severity: "high",
          referenceType: "host",
          referenceId: hostId,
          message: `Salary dropped ${dropPercent.toFixed(1)}% (${
            previousCycle.salaryUcoins
          } → ${currentCycle.salaryUcoins})`,
          meta: {
            previousAmount: previousCycle.salaryUcoins,
            currentAmount: currentCycle.salaryUcoins,
            dropPercent: dropPercent.toFixed(1),
            previousCycleId: previousCycle._id,
            currentCycleId: currentCycle._id,
          },
          deduplicationKey: `salary_drop_${hostId}_${currentCycle._id}`,
        });
      }
    }

    // Check 3: VIP with salary but 0 hours
    const Host = require("../models/Host");
    const host = await Host.findById(hostId).lean();
    if (
      host &&
      host.isVIP &&
      currentCycle.salaryUcoins > 0 &&
      currentCycle.hours === 0
    ) {
      await alertService.createAlert({
        type: "vip_anomaly",
        severity: "medium",
        referenceType: "host",
        referenceId: hostId,
        message: `VIP Host received ${currentCycle.salaryUcoins} U-coins but worked 0 hours`,
        meta: {
          cycleId: currentCycle._id,
          salary: currentCycle.salaryUcoins,
          hours: 0,
          diamonds: currentCycle.diamonds,
        },
        deduplicationKey: `vip_anomaly_${hostId}_${currentCycle._id}`,
      });
    }
  } catch (err) {
    // Log but don't throw - alerts should not interrupt salary calculation
    console.error("Alert check failed in hostSalary:", err.message);
  }
}

module.exports = { calculateHostSalary, checkHostSalaryAnomalies };
