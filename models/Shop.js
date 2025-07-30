const mongoose = require("mongoose");

const userItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  thumbnail: {
    type: String,
  },
  resource: {
    type: String,
  },
  validTill: {
    type: Date,
    required: true,
    default: null,
  },
  isDefault: {
    type: Boolean,
    required: true,
  },
  isOfficial: {
    type: Boolean,
    required: true,
  },
});

const ShopSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    item: userItemSchema,
    validTill: {
      type: Date,
      required: true,
      default: null,
    },
    itemType: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },

    isActive: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("shop", ShopSchema);
