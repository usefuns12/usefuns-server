const Host = require("../models/Host");
const HostStat = require("../models/HostStat");

/**
 * Track when host joins mic in a room
 * @param {ObjectId} hostId - The host's ID
 * @param {ObjectId} roomId - The room's ID
 */
async function onHostMicJoin(hostId, roomId) {
  try {
    const Room = require("../models/Rooms");
    await Room.findByIdAndUpdate(roomId, {
      lastHostJoinedAt: new Date(),
    });
    console.log(`Host ${hostId} joined mic in room ${roomId}`);
  } catch (error) {
    console.error("Error tracking host mic join:", error);
  }
}

/**
 * Track when host leaves mic in a room
 * @param {ObjectId} hostId - The host's ID
 * @param {ObjectId} roomId - The room's ID
 */
async function onHostMicLeave(hostId, roomId) {
  try {
    const Room = require("../models/Rooms");
    const room = await Room.findById(roomId);

    if (!room || !room.lastHostJoinedAt) {
      console.warn("No lastHostJoinedAt found for room:", roomId);
      return;
    }

    const now = new Date();
    const diffMs = now - room.lastHostJoinedAt;
    const diffHours = diffMs / (1000 * 60 * 60); // Convert to hours

    if (diffHours > 0) {
      // Update Host total hours
      await Host.findByIdAndUpdate(hostId, {
        $inc: { totalHostTimeHours: diffHours },
      });

      // Update HostStat for current period
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await HostStat.findOneAndUpdate(
        {
          hostId: hostId,
          date: { $gte: today },
        },
        {
          $inc: { hostTimeHours: diffHours },
          $setOnInsert: {
            hostId: hostId,
            date: today,
            gifts: 0,
          },
        },
        { upsert: true }
      );

      console.log(
        `Host ${hostId} left mic. Added ${diffHours.toFixed(2)} hours`
      );
    }

    // Clear the lastHostJoinedAt
    await Room.findByIdAndUpdate(roomId, {
      $unset: { lastHostJoinedAt: 1 },
    });
  } catch (error) {
    console.error("Error tracking host mic leave:", error);
  }
}

module.exports = {
  onHostMicJoin,
  onHostMicLeave,
};
