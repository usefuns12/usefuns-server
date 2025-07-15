const mongoose = require("mongoose");

const quantityCashbackSchema = new mongoose.Schema(
  {
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    cashbackAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuantityCashback", quantityCashbackSchema);
