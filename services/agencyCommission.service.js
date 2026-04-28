const Policy = require("../models/Policy");
const alertService = require("./alert.service");

async function calculateAgencyCommission(totalUcoins) {
  const policy = await Policy.findOne({ type: "agencyCommission" });

  if (!policy) throw new Error("Agency commission policy not configured");

  const slabs = Array.isArray(policy.agencyCommission)
    ? policy.agencyCommission
    : [];

  // Create policy snapshot (immutable)
  const policySnapshot = {
    policyId: policy._id,
    version: policy.version || 1,
    appliedAt: new Date(),
    salarySlabs: slabs,
  };

  let percentage = 0;

  for (const slab of slabs) {
    if (totalUcoins >= slab.minTotalUcoins) {
      percentage = slab.percentage;
    }
  }

  return {
    percentage,
    commissionUcoins: Math.floor((totalUcoins * percentage) / 100),
    policySnapshot, // Include snapshot for audit trail
  };
}

/**
 * Check for commission anomalies and create alerts
 * Called after commission is calculated
 */
async function checkAgencyCommissionAnomalies({
  agencyId,
  currentCommission,
  previousCommission,
}) {
  try {
    // Non-blocking: errors don't interrupt commission calculation

    if (
      previousCommission &&
      previousCommission.commissionUcoins > 0 &&
      currentCommission.commissionUcoins > 0
    ) {
      const dropPercent =
        ((previousCommission.commissionUcoins -
          currentCommission.commissionUcoins) /
          previousCommission.commissionUcoins) *
        100;

      if (dropPercent > 40) {
        await alertService.createAlert({
          type: "commission_drop",
          severity: "high",
          referenceType: "agency",
          referenceId: agencyId,
          message: `Commission dropped ${dropPercent.toFixed(1)}% (${
            previousCommission.commissionUcoins
          } → ${currentCommission.commissionUcoins})`,
          meta: {
            previousAmount: previousCommission.commissionUcoins,
            currentAmount: currentCommission.commissionUcoins,
            dropPercent: dropPercent.toFixed(1),
          },
          deduplicationKey: `commission_drop_${agencyId}_${new Date()
            .toISOString()
            .slice(0, 10)}`,
        });
      }
    }
  } catch (err) {
    // Log but don't throw - alerts should not interrupt commission calculation
    console.error("Alert check failed in agencyCommission:", err.message);
  }
}

module.exports = { calculateAgencyCommission, checkAgencyCommissionAnomalies };
