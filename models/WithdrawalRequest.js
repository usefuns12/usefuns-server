const mongoose = require("mongoose");

const WithdrawalRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amountRs: { type: Number, required: true },
    channel: { type: String, enum: ["bank", "upi"], required: true },
    bankDetails: {
      accountNumber: String,
      ifsc: String,
      name: String,
      email: String,
      phone: String,
      address: String,
    },
    upiId: String,
    pan: {
      name: String,
      number: String,
      photoUrl: String,
    },
    status: {
      type: String,
      enum: ["pending", "review", "completed", "rejected"],
      default: "pending",
    },
    payoutTxRef: String,
  },
  { timestamps: true }
);

WithdrawalRequestSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("WithdrawalRequest", WithdrawalRequestSchema);
