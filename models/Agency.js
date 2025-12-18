const mongoose = require("mongoose");

const AgencySchema = new mongoose.Schema(
  {
    agencyId: { type: Number, required: true, unique: true },
    code: String,
    name: String,
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // 🔹 Link Host with existing Customer collection
    customerRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      required: true, // enforce relation
    },
    country: String,
    hosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Host" }],
    stats: {
      totalHosts: { type: Number, default: 0 },
      activeHosts: { type: Number, default: 0 },
      newHosts: { type: Number, default: 0 },
    },
    logo: { type: String, default: null },
    banner: { type: String, default: null },
    description: { type: String, default: null },
  },
  { timestamps: true }
);

AgencySchema.index({ agencyId: 1 });

module.exports = mongoose.model("Agency", AgencySchema);
