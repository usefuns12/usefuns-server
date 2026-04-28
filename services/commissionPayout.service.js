const AgencyCommissionCycle = require("../models/AgencyCommissionCycle");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const Agency = require("../models/Agency");

/**
 * Pay commission to an agency for a specific commission cycle
 * @param {ObjectId} cycleId - AgencyCommissionCycle ID
 */
async function payAgencyCommission(cycleId) {
  try {
    const cycle = await AgencyCommissionCycle.findById(cycleId);

    if (!cycle) {
      throw new Error("Commission cycle not found");
    }

    if (cycle.status === "paid") {
      throw new Error("Commission already paid for this cycle");
    }

    if (cycle.commissionUcoins <= 0) {
      console.log(`⚠️ No commission to pay for agency ${cycle.agencyId}`);
      cycle.status = "paid";
      await cycle.save();
      return { success: true, amount: 0, message: "No commission earned" };
    }

    // Get agency to find owner userId
    const agency = await Agency.findById(cycle.agencyId);
    if (!agency) {
      throw new Error("Agency not found");
    }

    const ownerUserId = agency.ownerUserId || agency.userId;
    if (!ownerUserId) {
      throw new Error("Agency has no owner userId");
    }

    // Credit agency owner wallet
    const wallet = await Wallet.findOneAndUpdate(
      { userId: ownerUserId },
      {
        $inc: { ucoins: cycle.commissionUcoins },
        $setOnInsert: { userId: ownerUserId, diamonds: 0, beans: 0 },
      },
      { upsert: true, new: true }
    );

    // Create transaction record
    const transaction = await Transaction.create({
      userId: ownerUserId,
      type: "agencyCommission",
      token: "ucoin",
      amount: cycle.commissionUcoins,
      source: "agency_commission",
      status: "success",
      meta: {
        cycleId: cycle._id,
        agencyId: cycle.agencyId,
        cycleStart: cycle.cycleStart,
        cycleEnd: cycle.cycleEnd,
        totalHostSalaryUcoins: cycle.totalHostSalaryUcoins,
        commissionPercentage: cycle.commissionPercentage,
      },
    });

    // Mark cycle as paid
    cycle.status = "paid";
    await cycle.save();

    console.log(
      `✅ Paid ${cycle.commissionUcoins} U-coins commission to agency ${cycle.agencyId}`
    );

    return {
      success: true,
      amount: cycle.commissionUcoins,
      transaction: transaction._id,
      wallet: wallet,
    };
  } catch (error) {
    console.error("Error paying agency commission:", error);
    throw error;
  }
}

/**
 * Pay commissions for all pending cycles
 */
async function payAllPendingCommissions() {
  try {
    const unpaidCycles = await AgencyCommissionCycle.find({
      status: "pending",
    });

    console.log(`📊 Found ${unpaidCycles.length} unpaid commission cycles`);

    const results = [];

    for (const cycle of unpaidCycles) {
      try {
        const result = await payAgencyCommission(cycle._id);
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

    console.log(`✅ Processed ${results.length} commission payments`);

    return results;
  } catch (error) {
    console.error("Error paying pending commissions:", error);
    throw error;
  }
}

/**
 * Get commission payment history for an agency
 * @param {ObjectId} agencyId - The agency's ID
 * @param {Number} limit - Number of recent payments to retrieve
 */
async function getAgencyCommissionHistory(agencyId, limit = 10) {
  try {
    const cycles = await AgencyCommissionCycle.find({ agencyId })
      .sort({ cycleEnd: -1 })
      .limit(limit)
      .lean();

    return cycles;
  } catch (error) {
    console.error("Error getting agency commission history:", error);
    throw error;
  }
}

/**
 * Get commission summary for all agencies
 * @param {Date} startDate - Start date filter (optional)
 * @param {Date} endDate - End date filter (optional)
 */
async function getCommissionSummary(startDate, endDate) {
  try {
    const query = {};
    if (startDate || endDate) {
      query.cycleEnd = {};
      if (startDate) query.cycleEnd.$gte = startDate;
      if (endDate) query.cycleEnd.$lte = endDate;
    }

    const summary = await AgencyCommissionCycle.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          totalCommission: { $sum: "$commissionUcoins" },
          count: { $sum: 1 },
        },
      },
    ]);

    return summary;
  } catch (error) {
    console.error("Error getting commission summary:", error);
    throw error;
  }
}

module.exports = {
  payAgencyCommission,
  payAllPendingCommissions,
  getAgencyCommissionHistory,
  getCommissionSummary,
};
