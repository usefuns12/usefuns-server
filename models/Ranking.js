const mongoose = require("mongoose");

const RankingSchema = new mongoose.Schema(
  {
    name: String,
    snapshotDate: Date,
    items: [
      {
        entityId: mongoose.Schema.Types.ObjectId,
        metrics: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
);

RankingSchema.index({ name: 1, snapshotDate: -1 });

module.exports = mongoose.model("Ranking", RankingSchema);
