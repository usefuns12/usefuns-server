const mongoose = require("mongoose");

const NewAgencySchema = new mongoose.Schema(
  {
    agencyId: { type: Number, required: true, unique: true },
    code: String,
    name: String,
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    country: String,
    members: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: String,
        joinedAt: Date,
      },
    ],
    stats: {
      totalHosts: { type: Number, default: 0 },
      activeHosts: { type: Number, default: 0 },
      newHosts: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

NewAgencySchema.index({ agencyId: 1 });

module.exports = mongoose.model("NewAgency", NewAgencySchema);
