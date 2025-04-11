const mongoose = require("mongoose");
const RoomMemberSchema = new mongoose.Schema(
     {
          roomId: {
               type: String,
               required: true,

          },
          userId: {
               type: String,
               required: true,
          },
          memberType: {
               type: String,
               default: "Normal",
          }
     },
     {
          timestamps: true,
     }
);

module.exports = mongoose.model("roomMember", RoomMemberSchema);