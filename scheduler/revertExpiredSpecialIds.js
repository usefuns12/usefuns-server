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
      const prevUserId = user.oldUserId;
      const newUserId = user.userId;

      // 1️⃣ Revert user data in Customer collection
      user.userId = prevUserId;
      user.oldUserId = null;
      user.specialIdValidity = null;
      user.isSpecialId = false;
      await user.save();

      console.log(`Reverted user ${user._id} to original ID: ${user.userId}`);

      // 2️⃣ Update rooms where this user is the owner (or part of roomId fields)
      const updatedRooms = await models.Room.updateMany(
        { roomId: newUserId }, // Assuming `roomId` in Room stores the specialId earlier
        { $set: { roomId: prevUserId } }
      );

      console.log(
        `Updated ${updatedRooms.modifiedCount} rooms for user ${user._id}`
      );
    }
  } catch (error) {
    console.error("Cron job error:", error);
  }
};

// Run every hour
cron.schedule("0 * * * *", revertExpiredSpecialIds);
