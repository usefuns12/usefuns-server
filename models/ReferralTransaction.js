const mongoose = require("mongoose");

const ReferralTransactionSchema = new mongoose.Schema(
  {
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      required: true,
    },
    refereeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      // required: true,
    },
    amount: { type: Number, required: true },
    source: {
      type: String,
      enum: ["Recharge Bonus", "Referral Wallet Withdraw", "Other"],
      default: "Recharge Bonus",
    },
    status: { type: String, enum: ["earned", "withdrawn"], default: "earned" },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ReferralTransaction",
  ReferralTransactionSchema
);
