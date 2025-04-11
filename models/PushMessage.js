const mongoose = require("mongoose");
const PushMessageSchema = new mongoose.Schema(
     {
          userId: {
               type: String,
               required: true,
               index: true
          },
          message: {
               type: String,
               required: true,
          },
     },
     {
          timestamps: true,
     }
);

module.exports = mongoose.model("pushMessage", PushMessageSchema);