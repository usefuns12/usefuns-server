const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema(
  {
    // Alert type and severity
    type: {
      type: String,
      enum: [
        "salary_zero", // Host has 0 salary for 2+ cycles
        "salary_drop", // Salary dropped > 40%
        "commission_drop", // Agency commission dropped > 40%
        "vip_anomaly", // VIP hit target but 0 hours worked
        "gift_velocity", // Gift spike (10x average/hour)
        "gift_loop", // Same sender → same host repeatedly
        "self_gift", // User gifting themselves
        "wallet_mismatch", // Sum of txns ≠ wallet balance
        "cron_failure", // Scheduled job did not run
        "unlock_failure", // Wallet unlock cron failed
        "cycle_stuck", // Salary cycle stuck in pending
        "system_error", // Generic system failure
      ],
      required: true,
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },

    // Reference to affected entity
    referenceType: {
      type: String,
      enum: ["host", "agency", "user", "wallet", "cron", "cycle"],
      required: true,
    },

    referenceId: mongoose.Schema.Types.ObjectId,

    // Alert message and details
    message: {
      type: String,
      required: true,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Alert status
    status: {
      type: String,
      enum: ["open", "acknowledged", "resolved"],
      default: "open",
    },

    // Acknowledgement
    acknowledgedBy: mongoose.Schema.Types.ObjectId,
    acknowledgedAt: Date,

    // Resolution
    resolvedBy: mongoose.Schema.Types.ObjectId,
    resolvedAt: Date,
    resolutionNote: String,

    // Deduplication: track if alert already sent for this reference+type
    deduplicationKey: {
      type: String,
      index: true,
    },

    // When was the condition first detected
    detectedAt: {
      type: Date,
      default: Date.now,
    },

    // Audit trail
    auditLog: [
      {
        action: String,
        by: mongoose.Schema.Types.ObjectId,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: String,
      },
    ],
  },
  {
    timestamps: true,
    collection: "alerts",
  }
);

// Indexes for query performance
AlertSchema.index({ status: 1, createdAt: -1 });
AlertSchema.index({ type: 1, severity: 1, status: 1 });
AlertSchema.index({ referenceType: 1, referenceId: 1 });
AlertSchema.index({ deduplicationKey: 1 }); // For avoiding duplicates
AlertSchema.index({ createdAt: -1 }); // For listing recent alerts
AlertSchema.index({ acknowledgedAt: 1 }); // For unacknowledged alerts

module.exports = mongoose.model("Alert", AlertSchema);
