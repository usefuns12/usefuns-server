const mongoose = require("mongoose");

const UserDiamondHistorySchema = new mongoose.Schema(
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
          type: {
               type: Number,
               required: true,
          },
          uses: {
               type: String,
               required: true,
          },
     },
     {
          timestamps: true,
     }
);

module.exports = mongoose.model("userDiamondHistory", UserDiamondHistorySchema);