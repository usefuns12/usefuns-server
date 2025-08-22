const mongoose = require("mongoose");

const RoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ["CountryManager", "CountryAdmin", "Admin", "SubAdmin"],
      required: true,
      unique: true,
    },
    permissions: [{ type: String }],
    canCreate: [{ type: String }], // Roles this role can create
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", RoleSchema);
