const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema(
     {
          userId: {
               type: String,
               required: true,
               index: true
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
               default: null
          },
          transactionId: {
               type: String,
               default: null
          },
          isActive: { type: Boolean, required: true, default: true },
     },
     {
          timestamps: true,
     }
);

module.exports = mongoose.model("wallet", WalletSchema);