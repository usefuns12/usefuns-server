const mongoose = require("mongoose");

const giftTransactionSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      required: true,
    },
    gift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gift",
      required: true,
    },
    totalDiamonds: {
      type: Number,
      required: true,
    },
    countryCode: {
      type: String,
    },
    giftTime: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // includes createdAt and updatedAt
  }
);

module.exports = mongoose.model("GiftTransaction", giftTransactionSchema);
