const Host = require("../models/Host");
const HostStat = require("../models/HostStat");
const logger = require("../classes").Logger(__filename);

/**
 * Track when host joins mic in a room
 * @param {ObjectId} hostId - The host's ID
 * @param {ObjectId} roomId - The room's ID
 */
async function onHostMicJoin(hostId, roomId) {
  try {
    const Room = require("../models/Rooms");
    const now = new Date();
    await Room.findByIdAndUpdate(roomId, {
      $set: {
        lastHostJoinedAt: now,
        hostingTimeCurrentSession: 0,
      },
    });
    logger.info(
      `onHostMicJoin: host=${hostId} room=${roomId} at ${now.toISOString()}`,
    );
    return now;
  } catch (error) {
    logger.error("Error tracking host mic join:", error);
    return null;
  }
}

/**
 * Track when host leaves mic in a room
 * @param {ObjectId} hostId - The host's ID
 * @param {ObjectId} roomId - The room's ID
 */
async function onHostMicLeave(hostId, roomId, options = {}) {
  try {
    const Room = require("../models/Rooms");
    const room = await Room.findById(roomId);
    const fallbackJoinedAt = options.fallbackJoinedAt
      ? new Date(options.fallbackJoinedAt)
      : null;

    const startedAt = room?.lastHostJoinedAt || fallbackJoinedAt;

    if (!room || !startedAt) {
      logger.warn(
        `No lastHostJoinedAt found for room: ${roomId} (host=${hostId}, fallback=${fallbackJoinedAt ? fallbackJoinedAt.toISOString() : "null"})`,
      );
      return;
    }

    const now = new Date();
    const diffMs = now - startedAt;
    const diffHours = diffMs / (1000 * 60 * 60); // Convert to hours

    logger.info(
      `onHostMicLeave: host=${hostId} room=${roomId} startedAt=${startedAt.toISOString()} now=${now.toISOString()} diffMs=${diffMs} diffHours=${diffHours}${room.lastHostJoinedAt ? " source=room" : " source=fallback"}`,
    );

    if (diffHours > 0) {
      // Read previous total for logging
      const hostDoc = await Host.findById(hostId).lean();
      const prevTotal = hostDoc?.totalHostTimeHours || 0;

      // Update Host total hours
      await Host.findByIdAndUpdate(hostId, {
        $inc: { totalHostTimeHours: diffHours },
      });

      const newTotal = prevTotal + diffHours;
      logger.info(
        `Updated Host ${hostId} totalHostTimeHours: ${prevTotal} -> ${newTotal}`,
      );

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
        { upsert: true },
      );

      logger.info(
        `HostStat updated for host=${hostId} date=${today.toISOString()} addedHours=${diffHours}`,
      );
    }

    // Clear the lastHostJoinedAt
    await Room.findByIdAndUpdate(roomId, {
      $set: {
        hostingTimeCurrentSession: diffMs / 1000,
        hostingTimeLastSession: diffMs / 1000,
      },
      $unset: { lastHostJoinedAt: 1 },
    });

    return {
      startedAt,
      diffMs,
      diffHours,
      usedFallback: !room.lastHostJoinedAt && Boolean(fallbackJoinedAt),
    };
  } catch (error) {
    logger.error("Error tracking host mic leave:", error);
    return null;
  }
}

module.exports = {
  onHostMicJoin,
  onHostMicLeave,
};
