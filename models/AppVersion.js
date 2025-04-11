const mongoose = require("mongoose");
const AppVersionSchema = new mongoose.Schema(
     {

          message: {
               type: String,
               required: true,
          },
          version: {
               type: String,
               required: true,
          },

     },
     {
          timestamps: true,
     }
);

module.exports = mongoose.model("appVersion", AppVersionSchema);