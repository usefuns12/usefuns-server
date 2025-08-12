const mongoose = require("mongoose");

const HostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    hostId: { type: Number, required: true, unique: true },
    displayName: String,
    joinDate: Date,
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency" },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    totalHostTimeHours: { type: Number, default: 0 },
    giftsReceivedTotal: { type: Number, default: 0 },
    dailyStats: [
      {
        date: Date,
        hostTimeHours: Number,
        gifts: Number,
        visitors: Number,
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive", "left"],
      default: "active",
    },
  },
  { timestamps: true }
);

HostSchema.index({ agencyId: 1 });
HostSchema.index({ hostId: 1 });

module.exports = mongoose.model("Host", HostSchema);
