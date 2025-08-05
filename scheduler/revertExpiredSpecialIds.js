const cron = require("node-cron");
const models = require("../models");

const revertExpiredSpecialIds = async () => {
  try {
    const now = new Date();
    const usersToRevert = await models.Customer.find({
      specialIdValidity: { $lte: now },
      oldUserId: { $ne: null },
    });

    for (const user of usersToRevert) {
      user.userId = user.oldUserId;
      user.oldUserId = null;
      user.specialIdValidity = null;
      user.isSpecialId = false;

      await user.save();
      console.log(`Reverted user ${user._id} to original ID: ${user.userId}`);
    }
  } catch (error) {
    console.error("Cron job error:", error);
  }
};

cron.schedule("0 * * * *", revertExpiredSpecialIds); // every hour
