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
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
