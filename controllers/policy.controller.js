const models = require("../models");
const Policy = models.Policy;
const HostSalaryCycle = models.HostSalaryCycle;
const AgencyCommissionCycle = models.AgencyCommissionCycle;
const {
  startSalaryCycleCron,
  manualProcessCycles,
} = require("../services/salaryCycle.service");
const { payAllPendingSalaries } = require("../services/salaryPayout.service");
const {
  calculateCurrentMonthCommissions,
  calculateAllAgencyCommissions,
} = require("../services/commissionCalculation.service");
const {
  payAllPendingCommissions,
} = require("../services/commissionPayout.service");

/**
 * Create or update host salary policy
 * POST /api/admin/policy/host-salary
 */
exports.createHostSalaryPolicy = async (req, res) => {
  try {
    const {
      noDayLimits,
      minDays,
      maxDays,
      diamondTarget,
      hourSlabs,
      vipFullSalaryOnTarget,
      reward,
    } = req.body;

    // Validation - make minDays and maxDays optional if noDayLimits is true
    if (!diamondTarget || !hourSlabs || !Array.isArray(hourSlabs)) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: diamondTarget, hourSlabs",
      });
    }

    // Only validate minDays/maxDays if noDayLimits is false
    if (!noDayLimits) {
      if (!minDays || !maxDays) {
        return res.status(400).json({
          success: false,
          message: "minDays and maxDays required when no day limits is OFF",
        });
      }

      if (minDays < 1 || maxDays < minDays) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid days: minDays must be >= 1 and maxDays must be >= minDays",
        });
      }
    }

    // Validate hour slabs
    for (const slab of hourSlabs) {
      if (slab.minHours === undefined || slab.percentage === undefined) {
        return res.status(400).json({
          success: false,
          message: "Each hour slab must have minHours and percentage",
        });
      }
    }

    const policy = await Policy.findOneAndUpdate(
      { type: "hostSalary" },
      {
        type: "hostSalary",
        hostSalary: {
          noDayLimits: noDayLimits || false,
          minDays: noDayLimits ? null : minDays,
          maxDays: noDayLimits ? null : maxDays,
          diamondTarget,
          hourSlabs,
          vipFullSalaryOnTarget:
            vipFullSalaryOnTarget !== undefined ? vipFullSalaryOnTarget : true,
          reward: reward || { enabled: false, frameDays: 0 },
        },
      },
      { upsert: true, new: true },
    );

    res.json({
      success: true,
      message: "Host salary policy updated successfully",
      policy,
    });
  } catch (error) {
    console.error("Error creating host salary policy:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create/update host salary policy",
      error: error.message,
    });
  }
};

/**
 * Create or update agency commission policy
 * POST /api/admin/policy/agency-commission
 */
exports.createAgencyCommissionPolicy = async (req, res) => {
  try {
    const { commissionSlabs } = req.body;

    // Validation
    if (!commissionSlabs || !Array.isArray(commissionSlabs)) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: commissionSlabs (array)",
      });
    }

    // Validate commission slabs
    for (const slab of commissionSlabs) {
      if (slab.minTotalUcoins === undefined || slab.percentage === undefined) {
        return res.status(400).json({
          success: false,
          message:
            "Each commission slab must have minTotalUcoins and percentage",
        });
      }
    }

    const policy = await Policy.findOneAndUpdate(
      { type: "agencyCommission" },
      {
        type: "agencyCommission",
        agencyCommission: commissionSlabs,
      },
      { upsert: true, new: true },
    );

    res.json({
      success: true,
      message: "Agency commission policy updated successfully",
      policy,
    });
  } catch (error) {
    console.error("Error creating agency commission policy:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create/update agency commission policy",
      error: error.message,
    });
  }
};

/**
 * Get all policies
 * GET /api/admin/policy
 */
exports.getAllPolicies = async (req, res) => {
  try {
    const policies = await Policy.find();

    res.json({
      success: true,
      policies,
    });
  } catch (error) {
    console.error("Error getting policies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get policies",
      error: error.message,
    });
  }
};

/**
 * Manually trigger salary cycle processing
 * POST /api/admin/salary/process-cycles
 */
exports.processSalaryCycles = async (req, res) => {
  try {
    await manualProcessCycles();

    res.json({
      success: true,
      message: "Salary cycles processed successfully",
    });
  } catch (error) {
    console.error("Error processing salary cycles:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process salary cycles",
      error: error.message,
    });
  }
};

/**
 * Pay all pending host salaries
 * POST /api/admin/salary/pay-all
 */
exports.payAllSalaries = async (req, res) => {
  try {
    const results = await payAllPendingSalaries();

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      message: `Processed ${results.length} salary payments`,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error("Error paying salaries:", error);
    res.status(500).json({
      success: false,
      message: "Failed to pay salaries",
      error: error.message,
    });
  }
};

/**
 * Calculate agency commissions for current month
 * POST /api/admin/commission/calculate
 */
exports.calculateCommissions = async (req, res) => {
  try {
    const results = await calculateCurrentMonthCommissions();

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      message: `Calculated ${results.length} agency commissions`,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error("Error calculating commissions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate commissions",
      error: error.message,
    });
  }
};

/**
 * Pay all pending agency commissions
 * POST /api/admin/commission/pay-all
 */
exports.payAllCommissions = async (req, res) => {
  try {
    const results = await payAllPendingCommissions();

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      message: `Processed ${results.length} commission payments`,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error("Error paying commissions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to pay commissions",
      error: error.message,
    });
  }
};

/**
 * Get salary cycle statistics
 * GET /api/admin/salary/stats
 */
exports.getSalaryStats = async (req, res) => {
  try {
    const stats = await HostSalaryCycle.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalSalary: { $sum: "$salaryUcoins" },
        },
      },
    ]);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting salary stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get salary statistics",
      error: error.message,
    });
  }
};

/**
 * Get commission statistics
 * GET /api/admin/commission/stats
 */
exports.getCommissionStats = async (req, res) => {
  try {
    const stats = await AgencyCommissionCycle.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalCommission: { $sum: "$commissionUcoins" },
        },
      },
    ]);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting commission stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get commission statistics",
      error: error.message,
    });
  }
};
