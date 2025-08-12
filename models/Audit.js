const mongoose = require("mongoose");

const AuditSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: String,
    targetId: mongoose.Schema.Types.ObjectId,
    details: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

AuditSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("Audit", AuditSchema);
