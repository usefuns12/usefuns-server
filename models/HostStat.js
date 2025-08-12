const mongoose = require("mongoose");

const HostStatSchema = new mongoose.Schema(
  {
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Host",
      required: true,
    },
    date: { type: Date, required: true },
    visitors: Number,
    hostTimeHours: Number,
    gifts: Number,
  },
  { timestamps: true }
);

HostStatSchema.index({ hostId: 1, date: 1 });

module.exports = mongoose.model("HostStat", HostStatSchema);
