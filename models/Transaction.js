const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "recharge",
        "gift",
        "exchange",
        "withdrawal",
        "refund",
        "sellerRecharge",
        "salary",
        "agencyCommission",
        "salaryAdjustment",
        "commissionAdjustment",
        "reversal",
      ],
      required: true,
    },
    token: {
      type: String,
      enum: ["diamond", "beans", "ucoin", "rs"],
      required: true,
    },
    amount: { type: Number, required: true },
    source: String,
    fee: Number,
    status: {
      type: String,
      enum: ["pending", "success", "failed", "locked", "unlocked"],
      default: "pending",
    },
    // 🔒 STEP 3: Unlock tracking
    lockedUntil: {
      type: Date,
      description: "Date when locked funds become available",
    },
    unlockedAt: {
      type: Date,
      description: "Date when funds were actually unlocked",
    },
    unlockedBy: {
      type: String,
      enum: ["auto", "admin"],
      description: "How the funds were unlocked",
    },
    // 🔄 STEP 4: Adjustment tracking
    adjustmentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispute",
      description: "Reference to dispute that caused this adjustment",
    },
    adjustmentReason: {
      type: String,
      description: "Why this adjustment was made",
    },
    originalTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      description:
        "ID of transaction being adjusted (for adjustment transactions)",
    },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ adjustmentRef: 1 });
TransactionSchema.index({ originalTransactionId: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
