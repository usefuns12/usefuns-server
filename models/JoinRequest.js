const mongoose = require("mongoose");

const JoinRequestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "fromAgency",
        "fromCustomer",
        "leftRequest",
        "requestForAdminToReviewAgency",
        "requestForAdminToReviewHost",
      ],
      required: true,
    },
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Host",
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
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
