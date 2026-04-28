const models = require("../models");
const Dispute = models.Dispute;
const HostSalaryCycle = models.HostSalaryCycle;
const AgencyCommissionCycle = models.AgencyCommissionCycle;
const Transaction = models.Transaction;
const {
  recalculateSalaryFromDispute,
  recalculateCommissionFromDispute,
  simulateRecalculation,
} = require("../services/recalculation.service");
const {
  applySalaryAdjustment,
  applyCommissionAdjustment,
  reverseWithdrawal,
  createReversalTransaction,
} = require("../services/walletAdjustment.service");

/**
 * 📋 USER ENDPOINTS
 */

/**
 * Raise a new dispute
 * POST /api/disputes
 * Body: { type, referenceId, reason, evidence }
 */
exports.raiseDispute = async (req, res) => {
  try {
    const { type, referenceId, reason, evidence = [] } = req.body;
    const userId = req.user._id;

    if (!["salary", "commission", "withdrawal"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid dispute type",
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Reason is required",
      });
    }

    // Verify reference exists
    let referenceData;
    if (type === "salary") {
      referenceData = await HostSalaryCycle.findById(referenceId);
    } else if (type === "commission") {
      referenceData = await AgencyCommissionCycle.findById(referenceId);
    } else if (type === "withdrawal") {
      referenceData = await Transaction.findById(referenceId);
    }

    if (!referenceData) {
      return res.status(404).json({
        success: false,
        message: `${type} not found`,
      });
    }

    // Create dispute
    const dispute = await Dispute.create({
      type,
      referenceId,
      raisedBy: userId,
      reason,
      evidence,
      impactAmount:
        referenceData.salaryUcoins ||
        referenceData.commissionUcoins ||
        referenceData.amount,
      auditLog: [
        {
          action: "created",
          by: userId,
          note: "Dispute raised by user",
        },
      ],
    });

    console.log(`✅ Dispute raised by user ${userId}: ${dispute._id}`);

    res.status(201).json({
      success: true,
      message: "Dispute raised successfully",
      data: {
        disputeId: dispute._id,
        status: dispute.status,
        createdAt: dispute.createdAt,
      },
    });
  } catch (error) {
    console.error("Error raising dispute:", error);
    res.status(500).json({
      success: false,
      message: "Failed to raise dispute",
      error: error.message,
    });
  }
};

/**
 * Get my disputes
 * GET /api/disputes/my
 */
exports.getMyDisputes = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { raisedBy: userId };
    if (status) query.status = status;

    const disputes = await Dispute.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("raisedBy", "name email")
      .lean();

    const total = await Dispute.countDocuments(query);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Error getting my disputes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get disputes",
      error: error.message,
    });
  }
};

/**
 * Get dispute details
 * GET /api/disputes/:id
 */
exports.getDisputeDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const dispute = await Dispute.findById(id).populate(
      "raisedBy",
      "name email"
    );

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    // User can only view their own disputes (unless admin)
    if (
      !req.user.isAdmin &&
      dispute.raisedBy._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this dispute",
      });
    }

    // Populate reference data
    if (dispute.type === "salary") {
      dispute.referenceData = await HostSalaryCycle.findById(
        dispute.referenceId
      )
        .populate("hostId", "name email")
        .lean();
    } else if (dispute.type === "commission") {
      dispute.referenceData = await AgencyCommissionCycle.findById(
        dispute.referenceId
      )
        .populate("agencyId", "name")
        .lean();
    } else if (dispute.type === "withdrawal") {
      dispute.referenceData = await Transaction.findById(
        dispute.referenceId
      ).lean();
    }

    res.json({
      success: true,
      data: dispute,
    });
  } catch (error) {
    console.error("Error getting dispute details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get dispute details",
      error: error.message,
    });
  }
};

/**
 * 👨‍⚖️ ADMIN ENDPOINTS
 */

/**
 * List all disputes (admin)
 * GET /admin/disputes
 */
exports.listDisputesAdmin = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const disputes = await Dispute.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("raisedBy", "name email")
      .populate("resolution.resolvedBy", "name email")
      .lean();

    const total = await Dispute.countDocuments(query);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
        },
      },
    });
  } catch (error) {
    console.error("Error listing disputes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list disputes",
      error: error.message,
    });
  }
};

/**
 * Mark dispute as under review
 * PATCH /admin/disputes/:id/review
 */
exports.reviewDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const adminId = req.user._id;

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    // Log audit entry
    dispute.auditLog.push({
      action: "review_started",
      by: adminId,
      note: note || "Review started",
    });

    dispute.status = "under_review";
    await dispute.save();

    res.json({
      success: true,
      message: "Dispute marked as under review",
      data: {
        disputeId: dispute._id,
        status: dispute.status,
      },
    });
  } catch (error) {
    console.error("Error reviewing dispute:", error);
    res.status(500).json({
      success: false,
      message: "Failed to review dispute",
      error: error.message,
    });
  }
};

/**
 * Simulate what recalculation would look like
 * GET /admin/disputes/:id/simulate-recalculation
 */
exports.simulateRecalculationAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    const simulation = await simulateRecalculation(
      dispute.type,
      dispute.referenceId
    );

    res.json({
      success: true,
      data: {
        simulation,
        dispute: {
          id: dispute._id,
          type: dispute.type,
          reason: dispute.reason,
        },
      },
    });
  } catch (error) {
    console.error("Error simulating recalculation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to simulate recalculation",
      error: error.message,
    });
  }
};

/**
 * Resolve dispute with recalculation
 * PATCH /admin/disputes/:id/resolve/recalculate
 * Body: { note }
 */
exports.resolveWithRecalculation = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const adminId = req.user._id;

    const dispute = await Dispute.findById(id).populate("raisedBy");

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    // Get recalculation result
    const recalcResult =
      dispute.type === "salary"
        ? await recalculateSalaryFromDispute(
            dispute.referenceId,
            dispute.reason
          )
        : await recalculateCommissionFromDispute(dispute.referenceId);

    const adjustmentAmount = recalcResult.difference;
    const userId = dispute.raisedBy._id;

    // Apply adjustment to wallet
    let adjustmentResult;
    if (dispute.type === "salary") {
      adjustmentResult = await applySalaryAdjustment(
        userId.toString(),
        adjustmentAmount,
        `Dispute resolution: ${dispute.reason}`,
        dispute._id,
        dispute.referenceId
      );
    } else if (dispute.type === "commission") {
      adjustmentResult = await applyCommissionAdjustment(
        userId,
        adjustmentAmount,
        `Commission dispute resolution: ${dispute.reason}`,
        dispute._id,
        dispute.referenceId
      );
    }

    // Update cycle with recalculation history
    if (dispute.type === "salary") {
      const cycle = await HostSalaryCycle.findById(dispute.referenceId);
      cycle.recalculationHistory = cycle.recalculationHistory || [];
      cycle.recalculationHistory.push({
        timestamp: new Date(),
        adminId,
        reason: `Dispute resolution: ${dispute.reason}`,
        oldAmount: recalcResult.oldAmount,
        newAmount: recalcResult.newAmount,
        changes: recalcResult.metadata,
      });
      await cycle.save();
    }

    // Resolve dispute
    dispute.status = "resolved";
    dispute.resolution = {
      action: "recalculate",
      actionDetails: recalcResult,
      note: note || "Recalculation completed",
      resolvedBy: adminId,
      resolvedAt: new Date(),
    };
    dispute.recalculation = {
      oldAmount: recalcResult.oldAmount,
      newAmount: recalcResult.newAmount,
      difference: adjustmentAmount,
      reason: dispute.reason,
      transactionId: adjustmentResult.adjustmentTxnId,
    };
    dispute.auditLog.push({
      action: "resolved",
      by: adminId,
      note: `Recalculated: ${recalcResult.oldAmount} → ${recalcResult.newAmount}`,
      changes: recalcResult,
    });
    await dispute.save();

    console.log(`✅ Dispute ${id} resolved with recalculation`);

    res.json({
      success: true,
      message: "Dispute resolved with recalculation",
      data: {
        dispute: dispute,
        adjustment: adjustmentResult,
        recalculation: recalcResult,
      },
    });
  } catch (error) {
    console.error("Error resolving dispute:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resolve dispute",
      error: error.message,
    });
  }
};

/**
 * Resolve dispute by rejecting it
 * PATCH /admin/disputes/:id/resolve/reject
 * Body: { note }
 */
exports.rejectDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const adminId = req.user._id;

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    dispute.status = "rejected";
    dispute.resolution = {
      action: "reject",
      note: note || "Dispute rejected",
      resolvedBy: adminId,
      resolvedAt: new Date(),
    };
    dispute.auditLog.push({
      action: "rejected",
      by: adminId,
      note: note,
    });
    await dispute.save();

    res.json({
      success: true,
      message: "Dispute rejected",
      data: {
        disputeId: dispute._id,
        status: dispute.status,
      },
    });
  } catch (error) {
    console.error("Error rejecting dispute:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject dispute",
      error: error.message,
    });
  }
};

/**
 * Resolve dispute by approving adjustment amount
 * PATCH /admin/disputes/:id/resolve/approve
 * Body: { adjustmentAmount, note }
 */
exports.approveDisputeAdjustment = async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustmentAmount, note } = req.body;
    const adminId = req.user._id;

    if (typeof adjustmentAmount !== "number") {
      return res.status(400).json({
        success: false,
        message: "Adjustment amount is required and must be a number",
      });
    }

    const dispute = await Dispute.findById(id).populate("raisedBy");

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    const userId = dispute.raisedBy._id;

    // Apply adjustment
    const adjustmentResult = await applySalaryAdjustment(
      userId.toString(),
      adjustmentAmount,
      `Manual adjustment approved: ${note || dispute.reason}`,
      dispute._id,
      dispute.referenceId
    );

    // Resolve dispute
    dispute.status = "resolved";
    dispute.resolution = {
      action: "adjust",
      actionDetails: { adjustmentAmount },
      note: note || "Manual adjustment approved",
      resolvedBy: adminId,
      resolvedAt: new Date(),
    };
    dispute.recalculation = {
      difference: adjustmentAmount,
      reason: dispute.reason,
      transactionId: adjustmentResult.adjustmentTxnId,
    };
    dispute.auditLog.push({
      action: "resolved",
      by: adminId,
      note: `Manual adjustment: ${adjustmentAmount} U-coins`,
    });
    await dispute.save();

    res.json({
      success: true,
      message: "Dispute approved with adjustment",
      data: {
        dispute,
        adjustment: adjustmentResult,
      },
    });
  } catch (error) {
    console.error("Error approving dispute:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve dispute",
      error: error.message,
    });
  }
};
