const mongoose = require("mongoose");

const HostSalaryCycleSchema = new mongoose.Schema(
  {
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Host",
      required: true,
    },
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency" },

    cycleStart: Date,
    cycleEnd: Date,

    totalDiamonds: Number,
    validDiamonds: Number,
    totalHostHours: Number,

    salaryPercentage: Number,
    salaryUcoins: Number,

    rewardGranted: Boolean,

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

HostSalaryCycleSchema.index({ hostId: 1, cycleStart: 1 });

module.exports = mongoose.model("HostSalaryCycle", HostSalaryCycleSchema);
