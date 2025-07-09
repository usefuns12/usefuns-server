const cron = require("node-cron");
const mongoose = require("mongoose");
const models = require("../models");
const logger = require("../classes").Logger(__filename);

// Run every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  try {
    const now = new Date();

    const rooms = await models.Room.find({
      "kickHistory.expireAt": { $lte: now },
    });

    for (const room of rooms) {
      room.kickHistory = room.kickHistory.filter(
        (entry) => entry.expireAt > now
      );
      await room.save();
    }

    logger.info(`[CRON] Expired kicks removed at ${now.toISOString()}`);
  } catch (err) {
    logger.error(`[CRON ERROR] ${err.message}`);
  }
});
