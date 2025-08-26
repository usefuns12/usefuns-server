const mongoose = require("mongoose");

const JoinRequestSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["joinAgency"], required: true },
    fromAgencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
    },
    toHostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host" },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    message: String,
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

JoinRequestSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model("JoinRequest", JoinRequestSchema);
