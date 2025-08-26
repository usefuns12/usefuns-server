const models = require("../models");
const logger = require("../classes").Logger(__filename);
const mongoose = require("mongoose");
const moment = require("moment");
const { cleanupS3Files } = require("../utils/s3FileManager");

const getRooms = async (req, res) => {
  try {
    const rooms = await models.Room.find({});

    res
      .status(200)
      .json({ success: true, message: "Find successful.", data: rooms });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const getRoomsPagination = async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit) || 10; // Default to limit 10 if not specified
  const skip = (page - 1) * limit;

  try {
    const rooms = await models.Room.find({}).skip(skip).limit(limit);

    res
      .status(200)
      .json({ success: true, message: "Find successful.", data: rooms });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const searchRoom = async (req, res) => {
  const roomId = req.params.roomId;

  try {
    const room = await models.Room.find({
      roomId: { $regex: roomId, $options: "i" },
    })
      .limit(10)
      .lean();

    if (!room.length) {
      res.status(400).json({ success: false, message: "Room not found." });
    } else {
      res.status(200).json({
        success: true,
        message: "Search successful.",
        data: room,
      });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const getLatestRooms = async (req, res) => {
  const countryCode = req.params.countryCode;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10; // Set a default limit if not provided
  // Calculate the skip value based on the page and limit
  const skip = (page - 1) * limit;
  let condition = {};

  try {
    if (countryCode === "all") {
      condition.countryCode = countryCode;
    }
    const rooms = await models.Room.find(condition)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res
      .status(200)
      .send({ success: true, message: "Find successful.", data: rooms });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const getPopularRooms = async (req, res) => {
  const countryCode = req.params.countryCode;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10; // Set a default limit if not provided
  // Calculate the skip value based on the page and limit
  const skip = (page - 1) * limit;
  let condition = {};

  try {
    if (countryCode !== "all") {
      condition.countryCode = countryCode;
    }

    const rooms = await models.Room.aggregate([
      { $match: condition },
      {
        $addFields: {
          activeUsersCount: { $size: "$activeUsers" },
        },
      },
      {
        $sort: { activeUsersCount: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);
    res
      .status(200)
      .send({ success: true, message: "Find successful.", data: rooms });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const getRecentlyJoined = async (req, res) => {
  const id = req.params.id;

  try {
    const rooms = await models.Room.find({ lastMembers: id }).sort({
      updatedAt: -1,
    });
    res
      .status(200)
      .send({ success: true, message: "Find successful.", data: rooms });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const getRoomById = async (req, res) => {
  const id = req.params.id;
  let room;

  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      room = await models.Room.findOne({ _id: id });
    } else {
      room = await models.Room.findOne({ roomId: id });
    }

    if (!room) {
      return res.status(400).json({
        success: false,
        message: "Room not found",
      });
    }

    // Fetch owner user data
    const ownerUserData = await models.Customer.findById(room.ownerId);

    // Convert to plain object so we can append a new field
    const roomObj = room.toObject();
    roomObj.ownerUserData = ownerUserData || null;

    res
      .status(200)
      .send({ success: true, message: "Find successful.", data: roomObj });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const getRoomByUserId = async (req, res) => {
  const id = req.params.id;

  try {
    const room = await models.Room.findOne({ ownerId: id });

    if (!room) {
      return res.status(400).json({
        success: false,
        message: "Room not found",
      });
    }

    res
      .status(200)
      .send({ success: true, message: "Find successful.", data: room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const getRoomByGroupMembers = async (req, res) => {
  const id = req.params.id;

  try {
    const room = await models.Room.find({ groupMembers: id });

    if (!room) {
      return res.status(400).json({
        success: false,
        message: "Room not found",
      });
    }

    res
      .status(200)
      .send({ success: true, message: "Find successful.", data: room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const getRoomContribution = async (req, res) => {
  let { roomId, groupBy, display } = req.body;

  groupBy = groupBy || "users";
  display = display || "daily";

  let startDate, endDate;
  if (display === "daily") {
    startDate = moment().startOf("day").toDate();
  } else if (display === "weekly") {
    startDate = moment().subtract(15, "days").startOf("day").toDate();
  } else if (display === "monthly") {
    startDate = moment().subtract(30, "days").startOf("day").toDate();
  } else {
    return res.status(400).json({
      success: false,
      message: "Invalid display type. Use 'daily', 'weekly', or 'monthly'.",
    });
  }

  try {
    endDate = moment().endOf("day").toDate();
    const matchStage = {
      createdAt: { $gte: startDate, $lt: endDate },
    };

    if (roomId) {
      matchStage.roomId = mongoose.Types.ObjectId.createFromHexString(roomId);
    }

    const groupField = groupBy === "rooms" ? "$roomId" : "$sender";

    const results = await models.SendGift.aggregate([
      {
        $match: matchStage,
      },
      {
        $addFields: {
          giftDiamonds: { $multiply: ["$gift.diamonds", "$count"] },
        },
      },
      {
        $group: {
          _id: groupField,
          totalGiftDiamonds: { $sum: "$giftDiamonds" },
        },
      },
      {
        $sort: { totalGiftDiamonds: -1 }, // Sort senders by total gift value in descending order
      },
      {
        $limit: 20, // Limit results to top 20
      },
      {
        $lookup: {
          from: groupBy === "rooms" ? "rooms" : "customers",
          localField: "_id",
          foreignField: "_id",
          as: groupBy === "rooms" ? "roomInfo" : "customerInfo",
        },
      },
      {
        $unwind: { path: groupBy === "rooms" ? "$roomInfo" : "$customerInfo" }, // Unwind to get single document from customerInfo array
      },
      {
        $project: {
          _id: 1,
          totalGiftDiamonds: 1,
          ...(groupBy === "users" && { "customerInfo.name": 1 }),
          ...(groupBy === "users" && { "customerInfo.profileImage": 1 }),
          ...(groupBy === "users" && { "customerInfo.level": 1 }),
          ...(groupBy === "rooms" && { "roomInfo.name": 1 }),
          ...(groupBy === "rooms" && { "roomInfo.roomImage": 1 }),
          ...(groupBy === "rooms" && { "roomInfo.treasureBoxLevel": 1 }),
        },
      },
    ]);

    res
      .status(200)
      .json({ success: true, message: "Find successful.", data: results });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const addRoom = async (req, res) => {
  const { userId, name } = req.body;

  try {
    const isUserExist = await models.Customer.findOne(
      { _id: userId },
      { roomId: 1, userId: 1, countryCode: 1 }
    );
    if (!isUserExist) {
      return res.status(400).json({
        success: false,
        message: "please provide valid user id",
      });
    }

    const isRoomExist = await models.Room.findOne({ ownerId: userId });
    if (isRoomExist) {
      return res.status(400).json({
        success: false,
        message: "You already have a created room",
      });
    }

    const lastRoom = await models.Room.findOne()
      .sort({ _id: -1 })
      .select("groupName");
    const nextGroupNumber = lastRoom
      ? parseInt(lastRoom.groupName.slice(2)) + 1
      : 1;

    const room = await models.Room.create({
      roomId: isUserExist.userId,
      groupName: "GP" + nextGroupNumber,
      name,
      ownerId: userId,
      countryCode: isUserExist.countryCode,
      roomImage: req.body.image ? req.body.image : null,
      groupMembers: [userId],
    });

    isUserExist.roomId = room._id;
    await isUserExist.save();

    res.status(200).json({
      success: true,
      message: "Room created successfully.",
      data: room,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
    if (req.body.image) {
      cleanupS3Files(req.body.image);
    }
  }
};

const updateRoom = async (req, res) => {
  const id = req.params.id;
  const roomParams = req.body;

  if (req.body.image) {
    roomParams.roomImage = req.body.image;
  }

  if (
    "lastHostJoinedAt" in roomParams &&
    (roomParams.lastHostJoinedAt === "" ||
      roomParams.lastHostJoinedAt === "null")
  ) {
    roomParams.lastHostJoinedAt = null;
  }

  try {
    const roomData = await models.Room.findOneAndUpdate(
      { _id: id },
      { $set: roomParams },
      { new: true }
    );

    if (!roomData) {
      return res.status(400).json({
        success: false,
        message: "Room not found",
      });
    }

    // Fetch owner user data
    const ownerUserData = await models.Customer.findById(roomData.ownerId);

    // Convert to plain object so we can append a new field
    const roomObj = roomData.toObject();
    roomObj.ownerUserData = ownerUserData || null;

    io.to(id).emit("roomDataUpdate", roomObj);
    res.status(200).json({ success: true, message: "Updated successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const addActiveUser = async (req, res) => {
  const { userId, roomId } = req.body;

  if (!userId || !roomId) {
    return res.staus(400).json({
      success: false,
      message: `Please provide ${!userId ? "userId" : "roomId"}`,
    });
  }

  try {
    const [user, room] = await Promise.all([
      models.Customer.findOne({ _id: userId }),
      models.Room.findOne({ _id: roomId }),
    ]);

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }
    if (!room) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid roomId" });
    }
    if (room.blockedList.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: "User is blocked from joining this room",
      });
    }

    if (room.isLocked) {
      return res
        .status(400)
        .json({ success: false, message: "Room is locked" });
    }

    if (!room.activeUsers.includes(userId)) {
      await models.RoomMember.create({
        roomId: roomId,
        userId: userId,
      });

      await models.Room.updateOne(
        { _id: roomId },
        {
          $push: {
            activeUsers: userId,
          },
        }
      );

      user.recentlyJoinedRooms.push(roomId);
    }
    user.isLive = true;
    const userData = await user.save();

    io.to(userId).emit("userDataUpdate", userData);
    res
      .status(200)
      .json({ success: true, message: "User added successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const addLockedRoom = async (req, res) => {
  const { userId, roomId, password } = req.body;

  if (!userId || !roomId || !password) {
    return res.staus(400).json({
      success: false,
      message: `Please provide ${
        !userId ? "userId" : !roomId ? "roomId" : "password"
      }`,
    });
  }

  try {
    const [user, room] = await Promise.all([
      models.Customer.findOne({ _id: userId }),
      models.Room.findOne({ _id: roomId }),
    ]);

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }
    if (!room) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid roomId" });
    }
    if (room.activeUsers.includes(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }
    if (room.password !== password) {
      return res
        .status(400)
        .json({ success: false, message: "Password not matching" });
    }

    await models.RoomMember.create({
      roomId: roomId,
      userId: userId,
    });

    await models.Room.updateOne(
      { _id: roomId },
      {
        $push: {
          activeUsers: userId,
        },
      }
    );

    user.isLive = true;
    user.recentlyJoinedRooms.push(roomId);
    const userData = await user.save();

    io.to(userId).emit("userDataUpdate", userData);
    res
      .status(200)
      .json({ success: true, message: "User added successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const removeActiveUser = async (req, res) => {
  const { userId, roomId } = req.body;

  if (!userId || !roomId) {
    return res.staus(400).json({
      success: false,
      message: `Please provide ${!userId ? "userId" : "roomId"}`,
    });
  }

  try {
    const room = await models.Room.findOne({ _id: roomId });

    if (!room) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid roomId" });
    }

    await models.RoomMember.deleteOne({
      roomId: roomId,
      userId: userId,
    });

    await models.Room.updateOne(
      { _id: roomId },
      {
        $push: {
          lastMembers: userId,
        },
        $pull: {
          activeUsers: userId,
        },
      }
    );

    const userData = await models.Customer.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          isLive: false,
        },
        $pull: {
          recentlyJoinedRooms: roomId,
        },
      },
      { new: true }
    );

    io.to(userId).emit("userDataUpdate", userData);
    res
      .status(200)
      .json({ success: true, message: "User removed successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const addGroupActiveUser = async (req, res) => {
  const { userId, roomId } = req.body;

  if (!userId || !roomId) {
    return res.staus(400).json({
      success: false,
      message: `Please provide ${!userId ? "userId" : "roomId"}`,
    });
  }

  try {
    const [user, room] = await Promise.all([
      models.Customer.findOne({ _id: userId }),
      models.Room.findOne({ _id: roomId }),
    ]);

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }
    if (!room) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid roomId" });
    }
    if (room.groupMembers.includes(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists in group" });
    }

    await models.Room.updateOne(
      { _id: roomId },
      {
        $push: {
          groupMembers: userId,
        },
      }
    );

    res
      .status(200)
      .json({ success: true, message: "Member added successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const removeGroupActiveUser = async (req, res) => {
  const { userId, roomId } = req.body;

  if (!userId || !roomId) {
    return res.staus(400).json({
      success: false,
      message: `Please provide ${!userId ? "userId" : "roomId"}`,
    });
  }

  try {
    const room = await models.Room.findOne({ _id: roomId });

    if (!room) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid roomId" });
    }

    await models.Room.updateOne(
      { _id: roomId },
      {
        $pull: {
          groupMembers: userId,
        },
      }
    );

    res
      .status(200)
      .json({ success: true, message: "Member removed successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const blockUser = async (req, res) => {
  const { roomId, userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  try {
    const room = await models.Room.findById(roomId).select("blockedList");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const isBlocked = room.blockedList.includes(userId);
    const update = isBlocked
      ? { $pull: { blockedList: userId } }
      : { $addToSet: { blockedList: userId } };

    await models.Room.updateOne({ _id: roomId }, update);

    res.status(200).json({
      success: true,
      message: isBlocked
        ? "User removed from blocked list"
        : "User added to blocked list",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const addAdmin = async (req, res) => {
  const { userId, roomId } = req.body;

  if (!userId || !roomId) {
    return res.staus(400).json({
      success: false,
      message: `Please provide ${!userId ? "userId" : "roomId"}`,
    });
  }

  try {
    const [user, room] = await Promise.all([
      models.Customer.findOne({ _id: userId }),
      models.Room.findOne({ _id: roomId }),
    ]);

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }
    if (!room) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid roomId" });
    }
    if (room.admin.includes(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists in admin" });
    }

    await models.Room.updateOne(
      { _id: roomId },
      {
        $push: {
          admin: userId,
        },
      }
    );

    res
      .status(200)
      .json({ success: true, message: "Admin added successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const removeAdmin = async (req, res) => {
  const { userId, roomId } = req.body;

  if (!userId || !roomId) {
    return res.staus(400).json({
      success: false,
      message: `Please provide ${!userId ? "userId" : "roomId"}`,
    });
  }

  try {
    const room = await models.Room.findOne({ _id: roomId });

    if (!room) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid roomId" });
    }

    await models.Room.updateOne(
      { _id: roomId },
      {
        $pull: {
          admin: userId,
        },
      }
    );

    res
      .status(200)
      .json({ success: true, message: "Admin removed successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

// get list of blocked user in the room
const getBlockedUsers = async (req, res) => {
  const roomId = req.params.roomId;

  try {
    const room = await models.Room.findOne(
      { _id: roomId },
      { blockedList: 1 }
    ).populate("blockedList", "-pwd -token");

    if (!room) {
      return res.status(400).json({
        success: false,
        message: "Room not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Find successful.",
      data: room.blockedList,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

// unblock user in the room
const unblockUser = async (req, res) => {
  const { roomId, userId } = req.body;

  if (!userId || !roomId) {
    return res.status(400).json({
      success: false,
      message: `Please provide ${!userId ? "userId" : "roomId"}`,
    });
  }

  try {
    const room = await models.Room.findOne({ _id: roomId });

    if (!room) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid roomId" });
    }

    await models.Room.updateOne(
      { _id: roomId },
      { $pull: { blockedList: userId } }
    );

    res
      .status(200)
      .json({ success: true, message: "User unblocked successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const kickUser = async (req, res) => {
  const { roomId } = req.body;
  let { userId } = req.body;

  if (!userId || !roomId) {
    return res.status(400).json({
      success: false,
      message: `Please provide ${!userId ? "userId" : "roomId"}`,
    });
  }

  try {
    // Convert to ObjectId
    userId = new mongoose.Types.ObjectId(userId);

    const room = await models.Room.findById(roomId);
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    const kickedAt = new Date();
    const expireAt = new Date(kickedAt.getTime() + 3 * 60 * 60 * 1000); // 3 hours

    // Remove any existing kick entry for this user
    await models.Room.updateOne(
      { _id: roomId },
      { $pull: { kickHistory: { userId } } }
    );

    // Remove from active users and add to kick history
    await models.Room.updateOne(
      { _id: roomId },
      {
        $pull: { activeUsers: userId },
        $push: {
          kickHistory: {
            userId,
            kickedAt,
            expireAt,
          },
        },
      }
    );

    // Remove from RoomMember
    await models.RoomMember.deleteOne({ roomId, userId });

    res.status(200).json({
      success: true,
      message: "User kicked for 3 hours.",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getKickHistory = async (req, res) => {
  const roomId = req.params.roomId;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const room = await models.Room.findOne(
      { _id: roomId },
      { kickHistory: 1 }
    ).populate("kickHistory.userId", "name profileImage userId oldUserId");

    const recentKicks = room.kickHistory.filter(
      (entry) => new Date(entry.kickedAt) >= since
    );

    res.status(200).json({
      success: true,
      message: "Kick history retrieved.",
      data: recentKicks,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getRoomJoinedUsers = async (req, res) => {
  const roomId = req.params.roomId;

  try {
    // Get room details
    const room = await models.Room.findById(roomId)
      .select("activeUsers lastMembers")
      .lean();

    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    // Combine activeUsers + lastMembers and deduplicate
    const userIdsSet = new Set([
      ...room.activeUsers.map((id) => id.toString()),
      ...room.lastMembers.map((id) => id.toString()),
    ]);
    const userIds = Array.from(userIdsSet);

    // Fetch full user details
    const users = await models.Customer.find({ _id: { $in: userIds } }).select(
      "name profileImage email level isLive userId oldUserId"
    );

    res.status(200).json({
      success: true,
      message: "All users who ever joined the room.",
      data: users,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getBlockedUsersDetailed = async (req, res) => {
  const roomId = req.params.roomId;

  try {
    const room = await models.Room.findOne({ _id: roomId }).populate(
      "blockedList",
      "name profileImage"
    );

    res.status(200).json({
      success: true,
      message: "Blocked users fetched.",
      data: room.blockedList,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const muteUser = async (req, res) => {
  const { roomId, userId } = req.body;

  try {
    await models.Room.findByIdAndUpdate(roomId, {
      $addToSet: { mutedList: userId },
    });

    res.status(200).json({ success: true, message: "User muted." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const unmuteUser = async (req, res) => {
  const { roomId, userId } = req.body;

  try {
    await models.Room.updateOne(
      { _id: roomId },
      { $pull: { mutedList: userId } }
    );

    res.status(200).json({ success: true, message: "User unmuted." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const sendGift = async (req, res) => {
  try {
    const { senderId, receiverId, roomId, qtyId, giftId } = req.body;

    if (!senderId || !receiverId || !roomId || !qtyId || !giftId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const quantityData = await models.QuantityCashback.findById(qtyId);
    if (!quantityData) {
      return res.status(404).json({ message: "Invalid quantity ID." });
    }

    const { quantity, cashbackAmount } = quantityData;

    const selectedGift = await models.Gift.findById(giftId).populate(
      "categoryId"
    );
    if (!selectedGift) {
      return res.status(404).json({ message: "Gift not found." });
    }

    const categoryName =
      selectedGift.categoryId?.name?.toLowerCase() ||
      selectedGift.categoryId?.toLowerCase();

    const totalGiftDiamonds = selectedGift.diamonds * quantity;

    const receiver = await models.Customer.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    const sender = await models.Customer.findById(senderId);
    if (!sender) {
      return res.status(404).json({ message: "Sender not found." });
    }

    let actualReceiverBeans = totalGiftDiamonds; // Default: beans = diamonds
    let senderCashback = 0;

    // 🎁 Surprise gift logic
    if (categoryName === "surprise") {
      // 🟡 Old logic: Receiver gets half diamonds
      // actualReceiverDiamonds = Math.floor(totalGiftDiamonds / 2);

      // ✅ New logic: Receiver gets 60 beans
      actualReceiverBeans = 60;

      // ✅ Sender gets cashback only if it's surprise
      const shouldGiveCashback = Math.random() < 0.3;
      if (true) {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        const transactions = await models.GiftTransaction.aggregate([
          {
            $match: {
              countryCode: sender.countryCode,
              giftTime: { $gte: fiveMinutesAgo, $lte: now },
            },
          },
          {
            $group: {
              _id: null,
              totalDiamonds: { $sum: "$totalDiamonds" },
            },
          },
        ]);

        const recentTotal = transactions?.[0]?.totalDiamonds || 0;
        const maxCashback = Math.floor(recentTotal * 0.1);
        senderCashback = Math.floor(Math.random() * (maxCashback + 1));
      }
    }

    // 💎 Update sender
    sender.diamonds += senderCashback - totalGiftDiamonds;
    await sender.save();

    // 💰 Update receiver
    receiver.beans += actualReceiverBeans; // ✅ Always beans
    // 🟡 Old logic: receiver.diamonds += actualReceiverDiamonds;
    await receiver.save();

    // 📦 Save SendGift
    await models.SendGift.create({
      roomId,
      sender: senderId,
      receiver: receiverId,
      count: quantity,
      gift: selectedGift,
    });

    // 🧾 Save GiftTransaction
    await models.GiftTransaction.create({
      sender: senderId,
      receiver: receiverId,
      gift: selectedGift._id,
      totalDiamonds: actualReceiverBeans, // Optional: rename to totalBeans later
      countryCode: sender.countryCode,
      giftTime: new Date(),
    });

    // 📚 Diamond History
    await models.UserDiamondHistory.create([
      {
        userId: senderId,
        diamonds: totalGiftDiamonds,
        type: 1,
        uses: "Gift",
      },
      ...(senderCashback > 0
        ? [
            {
              userId: senderId,
              diamonds: senderCashback,
              type: 2,
              uses: "Cashback Rewards",
            },
          ]
        : []),
    ]);

    // 1. Emit to Room
    io.to(roomId).emit("giftSent", {
      senderId,
      receiverId,
      roomId,
      giftId,
      quantity,
      receiverReceivedBeans: actualReceiverBeans,
      senderReceivedCashbackDiamonds: senderCashback,
      gift: {
        name: selectedGift.name,
        diamonds: selectedGift.diamonds,
        category: categoryName,
      },
    });

    // 2. Emit to Sender for diamond update
    io.to(senderId).emit("diamondUpdate", {
      userId: senderId,
      totalDiamonds: sender.diamonds,
      receivedCashbackDiamonds: senderCashback,
    });

    // 3. Emit to Receiver for bean update (rename event if needed)
    io.to(receiverId).emit("beanUpdate", {
      userId: receiverId,
      totalBeans: receiver.beans,
      receivedBeans: actualReceiverBeans,
    });

    // ✅ Response
    res.status(200).json({
      message: `Gift sent successfully. Receiver got ${actualReceiverBeans} beans. ${
        senderCashback > 0
          ? `Sender received ₹${senderCashback} cashback.`
          : "No cashback rewarded this time."
      }`,
    });
  } catch (error) {
    console.error("Error in sendGift:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const banChatUser = async (req, res) => {
  const { roomId, userId } = req.body;

  try {
    await models.Room.updateOne(
      { _id: roomId },
      { $addToSet: { chatUserBannedList: userId } }
    );
    res.status(200).json({ success: true, message: "User chat banned." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const unbanChatUser = async (req, res) => {
  const { roomId, userId } = req.body;

  try {
    await models.Room.updateOne(
      { _id: roomId },
      { $pull: { chatUserBannedList: userId } }
    );
    res.status(200).json({ success: true, message: "User chat unbanned." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateSeatLocks = async (req, res) => {
  const { roomId, seatIndexes } = req.body; // seatIndexes should be an array of numbers

  if (!Array.isArray(seatIndexes)) {
    return res
      .status(400)
      .json({ success: false, message: "seatIndexes must be an array" });
  }

  try {
    await models.Room.updateOne(
      { _id: roomId },
      { $set: { seatLockedUserList: seatIndexes } }
    );
    res.status(200).json({ success: true, message: "Seat lock list updated." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateRoomSeatCount = async (req, res) => {
  const { roomId, seatCount } = req.body;

  if (!roomId || typeof seatCount !== "number") {
    return res
      .status(400)
      .json({ success: false, message: "roomId and seatCount are required." });
  }

  try {
    const room = await models.Room.findByIdAndUpdate(
      roomId,
      { noOfSeats: seatCount },
      { new: true }
    );

    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found." });
    }

    res.status(200).json({
      success: true,
      message: "Seat count updated successfully.",
      data: { roomId: room._id, noOfSeats: room.noOfSeats },
    });
  } catch (error) {
    console.error("Error updating seat count:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

module.exports = {
  getRooms,
  getRoomsPagination,
  searchRoom,
  getLatestRooms,
  getPopularRooms,
  getRecentlyJoined,
  getRoomById,
  getRoomByUserId,
  getRoomByGroupMembers,
  getRoomContribution,
  addRoom,
  updateRoom,
  addActiveUser,
  addLockedRoom,
  removeActiveUser,
  addGroupActiveUser,
  removeGroupActiveUser,
  blockUser,
  addAdmin,
  removeAdmin,
  getBlockedUsers,
  unblockUser,
  kickUser,
  getKickHistory,
  getRoomJoinedUsers,
  getBlockedUsersDetailed,
  muteUser,
  unmuteUser,
  sendGift,
  banChatUser,
  unbanChatUser,
  updateSeatLocks,
  updateRoomSeatCount,
};
