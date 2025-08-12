const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema(
  {
    // Existing fields
    userId: {
      type: String, // Keeping as String to match your existing design
      required: true,
      index: true,
    },
    diamonds: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
    },
    status: {
      type: String,
      required: true,
    },
    merchantTransactionId: {
      type: String,
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
    },
    isActive: { type: Boolean, required: true, default: true },

    // 🔹 New fields for integration with full wallet system
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers", // linking to your customers collection
    },
    beans: {
      type: Number,
      default: 0,
    },
    ucoins: {
      type: Number,
      default: 0,
    },
    fiatBalance: {
      type: Number,
      default: 0,
    },
    lastTopUpAt: {
      type: Date,
      default: null,
    },
    lastWithdrawAt: {
      type: Date,
      default: null,
    },

    // Optional: Link to a room/session if wallet action is tied to it
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "room",
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Indexes for speed
WalletSchema.index({ userId: 1, isActive: 1 });
WalletSchema.index({ userRef: 1 });
WalletSchema.index({ roomId: 1 });

module.exports = mongoose.model("wallet", WalletSchema);
