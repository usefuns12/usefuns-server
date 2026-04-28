const mongoose = require("mongoose");

const AgencyCommissionCycleSchema = new mongoose.Schema(
  {
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
    },

    cycleStart: Date,
    cycleEnd: Date,

    totalHostSalaryUcoins: Number,
    commissionPercentage: Number,
    commissionUcoins: Number,

    status: {
      type: String,
      enum: ["pending", "calculated", "paid", "held", "disputed"],
      default: "pending",
    },

    // Policy snapshot at calculation time (immutable)
    policySnapshot: {
      type: Object,
      required: false, // Will be required once implemented
    },

    // Calculation details
    calculation: Object,

    // Recalculation tracking
    recalculatedAt: Date,
    recalculatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    recalculationReason: String,
    recalculationHistory: [
      {
        timestamp: Date,
        adminId: mongoose.Schema.Types.ObjectId,
        reason: String,
        oldAmount: Number,
        newAmount: Number,
        changes: Object,
      },
    ],

    // Admin actions
    heldAt: Date,
    heldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    holdReason: String,
    releasedAt: Date,
    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
  },
  { timestamps: true }
);

AgencyCommissionCycleSchema.index({ agencyId: 1, cycleStart: 1 });

module.exports = mongoose.model(
  "AgencyCommissionCycle",
  AgencyCommissionCycleSchema
);
