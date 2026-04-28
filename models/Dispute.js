const mongoose = require("mongoose");

const DisputeSchema = new mongoose.Schema(
  {
    // 📋 What type of dispute?
    type: {
      type: String,
      enum: ["salary", "commission", "withdrawal"],
      required: true,
      description: "Type of financial dispute",
    },

    // 🔗 Link to the disputed transaction/cycle
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      description:
        "ID of disputed HostSalaryCycle, AgencyCommissionCycle, or Transaction",
    },

    // 👤 Who raised the dispute?
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      required: true,
      description: "User (host/agency) who raised the dispute",
    },

    // 📝 Why?
    reason: {
      type: String,
      required: true,
      description:
        "Reason for dispute (e.g., 'Calculation error', 'Hours incorrect')",
    },

    // 📸 Evidence
    evidence: {
      type: [String],
      default: [],
      description: "URLs or descriptions of evidence (screenshots, logs, etc.)",
    },

    // 🔴 Current status
    status: {
      type: String,
      enum: ["open", "under_review", "resolved", "rejected"],
      default: "open",
      description: "Current dispute status",
    },

    // 💰 What was the impact?
    impactAmount: {
      type: Number,
      description: "Amount in dispute (U-coins, salary, etc.)",
    },

    // ✅ Resolution details
    resolution: {
      action: {
        type: String,
        enum: [
          "recalculate",
          "reverse",
          "adjust",
          "approve",
          "reject",
          "partial_refund",
        ],
        description: "What action was taken to resolve",
      },
      actionDetails: {
        type: mongoose.Schema.Types.Mixed,
        description:
          "Details of action (e.g., adjustment amount, new calculation)",
      },
      note: String,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        description: "Admin who resolved the dispute",
      },
      resolvedAt: Date,
    },

    // 🔄 Recalculation (if applicable)
    recalculation: {
      oldAmount: Number,
      newAmount: Number,
      difference: Number,
      reason: String,
      transactionId: mongoose.Schema.Types.ObjectId,
    },

    // 🧮 Audit trail
    auditLog: [
      {
        action: String, // "created", "reviewed", "resolved", etc.
        by: mongoose.Schema.Types.ObjectId,
        timestamp: { type: Date, default: Date.now },
        note: String,
        changes: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
);

// Indexes
DisputeSchema.index({ status: 1, createdAt: -1 });
DisputeSchema.index({ raisedBy: 1 });
DisputeSchema.index({ type: 1, referenceId: 1 });
DisputeSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Dispute", DisputeSchema);
