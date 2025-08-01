const mongoose = require("mongoose");
const ShopItemSchema = new mongoose.Schema(
  {
    resource: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
    },
    name: {
      type: String,
      required: true,
    },
    itemType: {
      type: String,
      enum: [
        "frame",
        "chatBubble",
        "theme",
        "vehicle",
        "relationship",
        "specialId",
        "lockRoom",
        "extraSeat",
      ],
    },
    countryCode: {
      type: String,
      default: null,
    },
    priceAndValidity: {
      type: [
        {
          price: {
            type: Number,
            required: true,
          },
          validity: {
            type: Number,
            required: true,
          },
        },
      ],
      default: [],
    },
    isDefault: { type: Boolean, required: true, default: false },
    isOfficial: { type: Boolean, required: true },
    specialId: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("shopItem", ShopItemSchema);
