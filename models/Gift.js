const mongoose = require("mongoose");

const GiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    diamonds: {
      type: Number,
      required: true,
    },
    categoryId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "giftCategory",
    },
    countryCode: {
      type: String,
      default: null,
    },
    resource: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
    },
    isActive: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("gift", GiftSchema);
