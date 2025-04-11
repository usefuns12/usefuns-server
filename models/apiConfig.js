const mongoose = require("mongoose");
const ApiConfigSchema = new mongoose.Schema(
     {

          service: {
               type: String,
               required: true,
          },
          secretKeys: {
               type: [String],
               required: true,
          },

     },
     {
          timestamps: true,
     }
);

module.exports = mongoose.model("apiConfig", ApiConfigSchema);