const mongoose = require("mongoose");

const TreasureBoxItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
    },
    validTill: {
      type: Date,
    },
    diamondAmount: {
      type: Number,
    },
    beansAmount: {
      type: Number,
    },
    xp: {
      type: Number,
    },
  },
  { _id: false },
);

const TreasureBoxLevelSchema = new mongoose.Schema(
  {
    level: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    person1Items: {
      type: [TreasureBoxItemSchema],
      default: [],
    },
    person2Items: {
      type: [TreasureBoxItemSchema],
      default: [],
    },
    person3Items: {
      type: [TreasureBoxItemSchema],
      default: [],
    },
    otherItems: {
      type: [TreasureBoxItemSchema],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("TreasureBoxLevel", TreasureBoxLevelSchema);
