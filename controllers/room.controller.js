const models = require('../models');
const logger = require('../classes').Logger(__filename);
const mongoose = require("mongoose");
const moment = require('moment');
const { cleanupS3Files } = require('../utils/s3FileManager');

const getRooms = async (req, res) => {
    try 
    {
        const rooms = await models.Room.find({});

        res.status(200).json({ success: true, message: "Find successful.", data: rooms });
    } 
   catch(error) 
   {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
   }
}

const getRoomsPagination = async (req, res) => {
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
    const limit = parseInt(req.query.limit) || 10; // Default to limit 10 if not specified
    const skip = (page - 1) * limit;

    try
    {
        const rooms = await models.Room.find({}).skip(skip).limit(limit);

        res.status(200).json({ success: true, message: "Find successful.", data: rooms });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const searchRoom = async (req, res) => {
    const roomId = req.params.roomId;

    try
    {
        const room = await models.Room.find(
            { roomId: { $regex: roomId, $options: "i" } }
        ).limit(10).lean();

        if (!room.length) {
            res.status(400).json({ success: false, message: "Room not found." });
        } 
        else {
            res.status(200).json({
                success: true,
                message: "Search successful.",
                data: room,
            });
        }
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const getLatestRooms = async (req, res) => {
    
    const countryCode = req.params.countryCode;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // Set a default limit if not provided
    // Calculate the skip value based on the page and limit
    const skip = (page - 1) * limit;
    let condition = {};

    try
    {
        if (countryCode === "all") {
            condition.countryCode = countryCode;
        } 
        const rooms = await models.Room.find(condition).sort({ createdAt: -1 }).skip(skip).limit(limit);
        res.status(200).send({ success: true, message: "Find successful.", data: rooms });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const getPopularRooms = async (req, res) => {
    const countryCode = req.params.countryCode;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // Set a default limit if not provided
    // Calculate the skip value based on the page and limit
    const skip = (page - 1) * limit;
    let condition = {};

    try
    {
        if (countryCode !== "all") {
            condition.countryCode = countryCode;
        }
    
        const rooms = await models.Room.aggregate([
            { $match: condition },
            {
                $addFields: {
                    activeUsersCount: { $size: "$activeUsers" }
                }
            },
            {
                $sort: { activeUsersCount: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }
       ]);
       res.status(200).send({ success: true, message: "Find successful.", data: rooms });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
    
}

const getRecentlyJoined = async (req, res) => {
    const id = req.params.id;

    try
    {
        const rooms = await models.Room.find({ lastMembers: id }).sort({ updatedAt: -1 });
        res.status(200).send({ success: true, message: "Find successful.", data: rooms });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const getRoomById = async (req, res) => {
    const id = req.params.id;
    let room;

    try
    {
        if (mongoose.Types.ObjectId.isValid(id)) {
            room = await models.Room.findOne({ _id: id });
        } 
        else {
            room = await models.Room.findOne({ roomId: id });
        }

        if (!room) {
            return res.status(400).json({
              success: false, message: "Room not found",
            });
        }

        res.status(200).send({ success: true, message: "Find successful.", data: room });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const getRoomByUserId = async (req, res) => {
    const id = req.params.id;

    try
    {
        const room = await models.Room.findOne({ ownerId: id });

        if (!room) {
            return res.status(400).json({
              success: false, message: "Room not found",
            });
        }

        res.status(200).send({ success: true, message: "Find successful.", data: room });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const getRoomByGroupMembers = async (req, res) => {
    const id = req.params.id;

    try
    {
        const room = await models.Room.find({ groupMembers: id });

        if (!room) {
            return res.status(400).json({
              success: false, message: "Room not found",
            });
        }

        res.status(200).send({ success: true, message: "Find successful.", data: room });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const getRoomContribution = async (req, res) => {
    let { roomId, groupBy, display } = req.body;

    groupBy = groupBy || "users";
    display = display || "daily";
    
    let startDate, endDate;
    if (display === "daily") {
        startDate = moment().startOf("day").toDate();
    } 
    else if (display === "weekly") {
        startDate = moment().subtract(15, "days").startOf("day").toDate();
    } 
    else if (display === "monthly") {
        startDate = moment().subtract(30, "days").startOf("day").toDate();
    } 
    else {
        return res.status(400).json({ success: false, message: "Invalid display type. Use 'daily', 'weekly', or 'monthly'." });
    }

    try
    {
        endDate = moment().endOf("day").toDate();
        const matchStage = {
            createdAt: { $gte: startDate, $lt: endDate },
        }

        if(roomId) {
            matchStage.roomId = mongoose.Types.ObjectId.createFromHexString(roomId);
        }

        const groupField = groupBy === "rooms" ? "$roomId" : "$sender";

        const results = await models.SendGift.aggregate([
            {
                $match: matchStage
            },
            {
                $addFields: {
                    giftDiamonds: { $multiply: ["$gift.diamonds", "$count"] }
                }
            },
            {
                $group: {
                    _id: groupField,
                    totalGiftDiamonds: { $sum: "$giftDiamonds" },
                }
            },
            {
                $sort: { totalGiftDiamonds: -1 } // Sort senders by total gift value in descending order
            },
            {
                $limit: 20, // Limit results to top 20
            },
            {
                $lookup: {
                    from: groupBy === "rooms" ? "rooms" : "customers",
                    localField: "_id",
                    foreignField: "_id",
                    as: groupBy === "rooms" ? "roomInfo" : "customerInfo"
                }
            },
            {
                $unwind: { path: groupBy === "rooms" ? "$roomInfo" : "$customerInfo" }  // Unwind to get single document from customerInfo array
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
                }
            }
        ]);

        res.status(200).json({ success: true, message: "Find successful.", data: results });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const addRoom = async (req, res) => {
    const { userId, name } = req.body;
    
    try
    {
        const isUserExist = await models.Customer.findOne({ _id: userId }, { roomId: 1, userId: 1, countryCode: 1 });
        if (!isUserExist) {
            return res.status(400).json({
                success: false,
                message: "please provide valid user id"
            });
        }

        const isRoomExist = await models.Room.findOne({ ownerId: userId });
        if (isRoomExist) {
            return res.status(400).json({
                success: false,
                message: "You already have a created room"
            });
        }

        const lastRoom = await models.Room.findOne().sort({ _id: -1 }).select('groupName');
        const nextGroupNumber = lastRoom ? parseInt(lastRoom.groupName.slice(2)) + 1 : 1;

        const room = await models.Room.create({
            roomId: isUserExist.userId,
            groupName: "GP" + nextGroupNumber,
            name,
            ownerId: userId,
            countryCode: isUserExist.countryCode,
            roomImage: req.body.image ? req.body.image : null,
            groupMembers: [userId]
        });
       
        isUserExist.roomId = room._id;
        await isUserExist.save();

        res.status(200).json({
            success: true,
            message: "Room created successfully.",
            data: room,
        });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
        if(req.body.image) {
            cleanupS3Files(req.body.image);
        }
    }
}

const updateRoom = async (req, res) => {
    const id = req.params.id;
    const roomParams = req.body;
    
    if (req.body.image) {
        roomParams.roomImage = req.body.image;
    }

    if(('lastHostJoinedAt' in roomParams) && 
        (roomParams.lastHostJoinedAt === '' || roomParams.lastHostJoinedAt === 'null')) {
            roomParams.lastHostJoinedAt = null;
    }

    try
    {
        const roomData = await models.Room.findOneAndUpdate(
            { _id: id },
            { $set: roomParams },
            { new: true }
        );

        if (!roomData) {
            return res.status(400).json({
                success: false, message: "Room not found",
            });
        }

        io.to(id).emit('roomDataUpdate', roomData);
        res.status(200).json({ success: true, message: "Updated successfully."});
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const addActiveUser = async (req, res) => {
    const { userId, roomId } = req.body;

    if (!userId || !roomId) {
        return res.staus(400).json({
            success: false,
            message: `Please provide ${!userId ? 'userId' : 'roomId'}`,
        });
    }

    try
    {
        const [user, room] = await Promise.all([
            models.Customer.findOne({ _id: userId }),
            models.Room.findOne({ _id: roomId })
        ]);

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid userId" });
        } 
        if (!room) {
            return res.status(400).json({ success: false, message: "Invalid roomId" });
        }
        if (room.blockedList.includes(userId)) {
            return res.status(400).json({ success: false, message: "User is blocked from joining this room" });
        }
        if (room.activeUsers.includes(userId)) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }
        if (room.isLocked) {
            return res.status(400).json({ success: false, message: "Room is locked" });
        }

        await models.RoomMember.create({
            roomId: roomId,
            userId: userId
        });

        await models.Room.updateOne(
            { _id: roomId },
            { $push: {
                activeUsers: userId
            }}
        );

        user.isLive = true;
        user.recentlyJoinedRooms.push(roomId);
        const userData = await user.save();

        io.to(userId).emit('userDataUpdate', userData);
        res.status(200).json({ success: true, message: "User added successfully." });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const addLockedRoom = async (req, res) => {
    const { userId, roomId, password } = req.body;

    if (!userId || !roomId || !password) {
        return res.staus(400).json({
            success: false,
            message: `Please provide ${!userId ? 'userId' : !roomId ? 'roomId' :  'password'}`,
        });
    }

    try
    {
        const [user, room] = await Promise.all([
            models.Customer.findOne({ _id: userId }),
            models.Room.findOne({ _id: roomId })
        ]);

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid userId" });
        } 
        if (!room) {
            return res.status(400).json({ success: false, message: "Invalid roomId" });
        }
        if (room.activeUsers.includes(userId)) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }
        if (room.password !== password) {
            return res.status(400).json({ success: false, message: "Password not matching" });
        }

        await models.RoomMember.create({
            roomId: roomId,
            userId: userId
        });

        await models.Room.updateOne(
            { _id: roomId },
            { $push: {
                activeUsers: userId
            }}
        );

        user.isLive = true;
        user.recentlyJoinedRooms.push(roomId);
        const userData = await user.save();

        io.to(userId).emit('userDataUpdate', userData);
        res.status(200).json({ success: true, message: "User added successfully." });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const removeActiveUser = async (req, res) => {
    const { userId, roomId } = req.body;

    if (!userId || !roomId) {
        return res.staus(400).json({
            success: false,
            message: `Please provide ${!userId ? 'userId' : 'roomId'}`,
        });
    }

    try
    {
        const room = await models.Room.findOne({ _id: roomId });

        if (!room) {
            return res.status(400).json({ success: false, message: "Invalid roomId" });
        }

        await models.RoomMember.deleteOne({
            roomId: roomId,
            userId: userId
        });

        await models.Room.updateOne(
            { _id: roomId },
            {
                $push: {
                    lastMembers: userId
                },
                $pull: {
                    activeUsers: userId
                }
            }
        );

        const userData = await models.Customer.findOneAndUpdate(
            { _id: userId },
            {
                $set: {
                    isLive: false
                },
                $pull: {
                    recentlyJoinedRooms: roomId
                }
            }, 
            { new: true }
        );

        io.to(userId).emit('userDataUpdate', userData);
        res.status(200).json({ success: true, message: "User removed successfully." });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const addGroupActiveUser = async (req, res) => {
    const { userId, roomId } = req.body;

    if (!userId || !roomId) {
        return res.staus(400).json({
            success: false,
            message: `Please provide ${!userId ? 'userId' : 'roomId'}`,
        });
    }

    try
    {
        const [user, room] = await Promise.all([
            models.Customer.findOne({ _id: userId }),
            models.Room.findOne({ _id: roomId })
        ]);

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid userId" });
        } 
        if (!room) {
            return res.status(400).json({ success: false, message: "Invalid roomId" });
        }
        if (room.groupMembers.includes(userId)) {
            return res.status(400).json({ success: false, message: "User already exists in group" });
        }

        await models.Room.updateOne(
            { _id: roomId },
            { $push: {
                groupMembers: userId
            }}
        );

        res.status(200).json({ success: true, message: "Member added successfully." });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const removeGroupActiveUser = async (req, res) => {
    const { userId, roomId } = req.body;

    if (!userId || !roomId) {
        return res.staus(400).json({
            success: false,
            message: `Please provide ${!userId ? 'userId' : 'roomId'}`,
        });
    }

    try
    {
        const room = await models.Room.findOne({ _id: roomId });

        if (!room) {
            return res.status(400).json({ success: false, message: "Invalid roomId" });
        }

        await models.Room.updateOne(
            { _id: roomId },
            {
                $pull: {
                    groupMembers: userId
            }}
        );

        res.status(200).json({ success: true, message: "Member removed successfully." });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const blockUser = async (req, res) => {
    const { roomId, userId } = req.body;

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: "User ID is required",
        });
    }

    try
    {
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

        await models.Room.updateOne(
            {_id: roomId},
            update
        );

        res.status(200).json({
            success: true,
            message: isBlocked
                ? "User removed from blocked list"
                : "User added to blocked list",
        });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const addAdmin = async (req, res) => {
    const { userId, roomId } = req.body;

    if (!userId || !roomId) {
        return res.staus(400).json({
            success: false,
            message: `Please provide ${!userId ? 'userId' : 'roomId'}`,
        });
    }

    try
    {
        const [user, room] = await Promise.all([
            models.Customer.findOne({ _id: userId }),
            models.Room.findOne({ _id: roomId })
        ]);

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid userId" });
        } 
        if (!room) {
            return res.status(400).json({ success: false, message: "Invalid roomId" });
        }
        if (room.admin.includes(userId)) {
            return res.status(400).json({ success: false, message: "User already exists in admin" });
        }

        await models.Room.updateOne(
            { _id: roomId },
            { $push: {
                admin: userId
            }}
        );

        res.status(200).json({ success: true, message: "Admin added successfully." });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}

const removeAdmin = async (req, res) => {
    const { userId, roomId } = req.body;

    if (!userId || !roomId) {
        return res.staus(400).json({
            success: false,
            message: `Please provide ${!userId ? 'userId' : 'roomId'}`,
        });
    }

    try
    {
        const room = await models.Room.findOne({ _id: roomId });

        if (!room) {
            return res.status(400).json({ success: false, message: "Invalid roomId" });
        }

        await models.Room.updateOne(
            { _id: roomId },
            {
                $pull: {
                    admin: userId
            }}
        );

        res.status(200).json({ success: true, message: "Admin removed successfully." });
    }
    catch(error)
    {
        res.status(400).json({ success: false, message: error.message });
        logger.error(error);
    }
}


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
    removeAdmin
}