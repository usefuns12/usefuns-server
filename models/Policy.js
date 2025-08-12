const mongoose = require("mongoose");

const PolicySchema = new mongoose.Schema(
  {
    name: String,
    content: String,
    effectiveDate: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Policy", PolicySchema);
