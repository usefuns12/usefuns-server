const mongoose = require("mongoose");

const UserDiamondHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    diamonds: {
      type: Number,
      required: true,
    },
    type: {
      type: Number,
      required: true,
      enum: [1, 2], // 1: Debited, 2: Credited
    },
    uses: {
      type: String,
      required: true,
      enum: [
        "All",
        "Gift",
        "Shop",
        "Game",
        "Treasure Box",
        "Lucky Wheel",
        "Beans To Diamonds",
        "Cashback Rewards",
      ],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("userDiamondHistory", UserDiamondHistorySchema);
