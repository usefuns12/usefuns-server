const mongoose = require("mongoose");

const ClubSchema = new mongoose.Schema(
     {
          clubId: {
               type: String,
               required: true,
               unique: true
          },
          userId: {
               type: mongoose.Schema.Types.ObjectId,
               ref: "customers",
               required: true,
               unique: true
          },
          name: {
               type: String,
               required: true,
          },
          label: {
               type: String,
               default: null
          },
          announcement: {
               type: String,
               default: null
          },
          totalDiamond: {
               type: Number,
               default: 0
          },
          activeUsers: [
               {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "customers"
               }
          ],
          lastMembers: [
               {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "customers"
               }
          ],
          image: {
               type: String,
               required: true,
          },
          isActive: { type: Boolean, required: true, default: true },
     },
     {
          timestamps: true,
     }
);

module.exports = mongoose.model("club", ClubSchema);