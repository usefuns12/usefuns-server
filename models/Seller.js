const mongoose = require("mongoose");

const SellerSchema = new mongoose.Schema(
  {
    sellerId: { type: Number, required: true, unique: true },
    name: String,
    countryAuthorityId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Merchant authority
    diamondsAvailable: { type: Number, default: 0 },
    subSellers: [
      {
        sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: String,
        createdAt: Date,
      },
    ],
  },
  { timestamps: true }
);

SellerSchema.index({ sellerId: 1 });

module.exports = mongoose.model("Seller", SellerSchema);
