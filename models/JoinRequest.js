const mongoose = require("mongoose");

const JoinRequestSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["joinAgency", "joinHosting"], required: true },
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toAgencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency" },
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
