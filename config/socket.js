const logger = require("../classes").Logger(__filename);
const { default: mongoose } = require("mongoose");
const models = require("../models");
const constants = require("../utils/constants.json");
const xpSeries = constants.xpSeries.map((value) => BigInt(value));
const moment = require("moment");

const configure = async (app, server) => {
  const io = require("socket.io")(server, {
    cors: {
      origin: "*",
    },
  });

  app.set("io", io);
  global.io = io;

  io.on("connection", (socket) => {
    console.log("User connected--->", socket.id);

    //For emitting events based on userId (_id)
    socket.on("join", (userId) => {
      logger.info("user joined", userId);
      console.log("user joined", userId);
      socket.data.userId = userId;
      socket.join(userId);
    });

    // For joining room
    socket.on("joinRoom", async ({ userId, roomId }) => {
      try {
        logger.info(`user ${userId} joined room ${roomId}`);

        // Save to socket data
        socket.data.userId = userId;
        socket.data.roomId = roomId;

        // Join socket.io room
        socket.join(roomId);

        // Update currentJoinedRoomId in customer model
        await models.Customer.findByIdAndUpdate(userId, {
          currentJoinedRoomId: new mongoose.Types.ObjectId(roomId),
        });

        logger.info(`Updated currentJoinedRoomId for user ${userId}`);
      } catch (error) {
        logger.error(`Error in joinRoom: ${error.message}`);
      }
    });

    socket.on("leaveRoom", async () => {
      const userId = socket.data.userId;
      const roomId = socket.data.roomId;

      if (!userId && !roomId) {
        logger.warn(
          `leaveRoom event triggered without userId and roomId for socket ${socket.id}`,
        );
        console.log(
          `Warning: leaveRoom event triggered without userId and roomId for socket ${socket.id}`,
        );
        return;
      }

      logger.info(
        `Received leaveRoom event with data: userId=${userId}, roomId=${roomId}`,
      );
      console.log(
        `Received leaveRoom event with data: userId=${userId}, roomId=${roomId}`,
      );

      if (userId && !roomId) {
        socket.leave(socket.data.userId);
        console.log(`User leaved ${socket.id}`);
        return;
      }

      try {
        socket.leave(roomId);
        console.log(`User ${socket.id} left room ${roomId} (${userId})`);

        await models.RoomMember.deleteOne({ roomId, userId });

        await models.Room.updateOne(
          { _id: roomId },
          {
            $pull: { activeUsers: userId },
            $push: { lastMembers: userId },
          },
        );

        await models.Customer.updateOne(
          { _id: userId },
          {
            $set: {
              isLive: false,
              currentJoinedRoomId: null, // <-- Set room reference to null
            },
            $pull: { recentlyJoinedRooms: roomId },
          },
        );

        console.log(
          `Client ${socket.id} has been removed from room ${roomId} (${userId})`,
        );
      } catch (error) {
        logger.error(`Error leaving room ${roomId} (${userId}):`, error);
      }
    });

    /******************** Seat On/Off Events ********************/
    socket.on("seatOn", async () => {
      try {
        const userId = socket.data.userId;

        const userData = await models.Customer.findByIdAndUpdate(userId, {
          $set: { onSeat: true },
        });

        io.to(userId).emit("userDataUpdate", userData);

        logger.info(`User ${userId} sat on seat in room`);
      } catch (error) {
        logger.error(`Error in seatOn: ${error.message}`);
      }
    });

    socket.on("seatOff", async () => {
      try {
        const userId = socket.data.userId;
        const userData = await models.Customer.findByIdAndUpdate(userId, {
          $set: { onSeat: false },
        });

        io.to(userId).emit("userDataUpdate", userData);

        logger.info(`User ${userId} left seat in room`);
      } catch (error) {
        logger.error(`Error in seatOff: ${error.message}`);
      }
    });

    socket.on("disconnect", async () => {
      // Retrieve userId and roomId from socket object
      const userId = socket.data.userId;
      const roomId = socket.data.roomId;

      if (!userId && !roomId) {
        logger.warn(
          `leaveRoom event triggered without userId and roomId for socket ${socket.id}`,
        );
        console.log(
          `Warning: leaveRoom event triggered without userId and roomId for socket ${socket.id}`,
        );
        return;
      }

      logger.info(
        `Received leaveRoom event with data: userId=${userId}, roomId=${roomId}`,
      );
      console.log(
        `Received leaveRoom event with data: userId=${userId}, roomId=${roomId}`,
      );

      if (userId && !roomId) {
        socket.leave(socket.data.userId);
        console.log(`User leaved ${socket.id}`);
        return;
      }

      try {
        socket.leave(roomId);
        console.log(`User ${socket.id} left room ${roomId} (${userId})`);

        await models.RoomMember.deleteOne({ roomId, userId });

        const room = await models.Room.findOneAndUpdate(
          { _id: roomId },
          {
            $pull: { activeUsers: userId },
            $push: { lastMembers: userId },
          },
          {
            projection: {
              _id: 1,
              activeUsers: 1,
              lastMembers: 1,
              ownerId: 1,
              lastHostJoinedAt: 1,
              hostingTimeCurrentSession: 1,
              hostingTimeLastSession: 1,
            },
          },
        );

        await models.Customer.findOneAndUpdate(
          { _id: userId },
          {
            $set: { isLive: false },
            $pull: { recentlyJoinedRooms: roomId },
          },
        );

        if (room.ownerId === userId) {
          if (room.lastHostJoinedAt !== null) {
            const currentHostTime = moment().diff(
              moment(room.lastHostJoinedAt),
              "seconds",
            );
            await models.Room.updateOne(
              { _id: roomId },
              {
                $set: {
                  hostingTimeCurrentSession: currentHostTime,
                  lastHostJoinedAt: null,
                },
              },
            );
          }
        }

        console.log(
          `Client ${socket.id} has been removed from room ${roomId} (${userId})`,
        );
      } catch (error) {
        logger.error(`Error leaving room ${roomId} (${userId}):`, error);
      }
    });

    // /******************** For Sending Gifts ********************/
    // socket.on("sendGift", async (data) => {
    //   const { sender, receiver, giftId, count } = data;

    //   if (
    //     socket.data.userId &&
    //     socket.data.roomId &&
    //     sender &&
    //     receiver &&
    //     giftId
    //   ) {
    //     try {
    //       const roomId = socket.data.roomId;
    //       const [customers, gift] = await Promise.all([
    //         models.Customer.find(
    //           { _id: { $in: [sender, receiver] } },
    //           { userId: 1, diamonds: 1, usedDiamonds: 1, xp: 1, beans: 1 }
    //         ).lean(),
    //         models.Gift.findOne({ _id: giftId }).lean(),
    //       ]);

    //       if (customers.length < 2 || !gift) {
    //         logger.warn(
    //           `Invalid data: sender=${sender}, receiver=${receiver}, giftId=${giftId}`
    //         );
    //         return;
    //       }

    //       const senderC = customers.find((customer) =>
    //         customer._id.equals(sender)
    //       );
    //       const receiverC = customers.find((customer) =>
    //         customer._id.equals(receiver)
    //       );

    //       if (!senderC || !receiverC) {
    //         logger.warn("Sender or receiver not found");
    //         return;
    //       }

    //       const giftDiamonds = gift.diamonds * count;

    //       // ✅ Check if sender has enough diamonds
    //       if (senderC.diamonds < giftDiamonds) {
    //         logger.warn(
    //           `Not enough diamonds: sender=${senderC._id}, diamonds=${senderC.diamonds}, required=${giftDiamonds}`
    //         );
    //         io.to(sender).emit("errorMessage", {
    //           success: false,
    //           message: "Not enough diamonds to send this gift",
    //         });
    //         return;
    //       }

    //       let senderCoin = senderC.diamonds - giftDiamonds;
    //       let usedDiamonds = senderC.usedDiamonds + giftDiamonds;
    //       let xp = BigInt(senderC.xp) + BigInt(giftDiamonds);
    //       let beans = receiverC.beans + giftDiamonds;

    //       if (xp && xp < 0n) {
    //         logger.warn("Invalid Xp value or Xp Cannot be negative.");
    //         return;
    //       }
    //       let level = getUserLevel(xp);

    //       const userData = await models.Customer.findOneAndUpdate(
    //         { _id: sender },
    //         {
    //           $set: {
    //             diamonds: senderCoin,
    //             xp: xp.toString(),
    //             usedDiamonds: usedDiamonds,
    //             level: level,
    //           },
    //         },
    //         { new: true }
    //       );

    //       await models.SendGift.create({
    //         roomId: roomId,
    //         sender: sender,
    //         count: count,
    //         receiver: receiver,
    //         gift: gift,
    //       });

    //       io.to(sender).emit("userDataUpdate", userData);

    //       const userData1 = await models.Customer.findOneAndUpdate(
    //         { _id: receiver },
    //         {
    //           $set: {
    //             beans: beans,
    //           },
    //         },
    //         { new: true }
    //       );

    //       await models.UserDiamondHistory.create({
    //         userId: senderC.userId,
    //         diamonds: giftDiamonds,
    //         type: 1,
    //         uses: "Gift",
    //       });

    //       io.to(receiver).emit("userDataUpdate", userData1);

    //       // Treasure Box Level update
    //       const rooms = await models.Room.findOne({ _id: roomId });
    //       let totalDiamonds = rooms.diamondsUsedToday + giftDiamonds;
    //       let treasureBoxLevel = getTreasureBoxLevel(totalDiamonds);

    //       const resp = {
    //         diamondsUsedToday: totalDiamonds,
    //         treasureBoxLevel: treasureBoxLevel,
    //         totalDiamondsUsed: rooms.totalDiamondsUsed + giftDiamonds,
    //         diamondsUsedCurrentSeason:
    //           rooms.diamondsUsedCurrentSeason + giftDiamonds,
    //       };

    //       rooms.diamondsUsedToday = resp.diamondsUsedToday;
    //       rooms.treasureBoxLevel = resp.treasureBoxLevel;
    //       rooms.totalDiamondsUsed = resp.totalDiamondsUsed;
    //       rooms.diamondsUsedCurrentSeason = resp.diamondsUsedCurrentSeason;
    //       await rooms.save();

    //       io.to(roomId).emit("giftUpdate", {
    //         receiver,
    //         giftId,
    //         count,
    //         sender,
    //         points: giftDiamonds,
    //       });
    //       io.to(roomId).emit("treasureBoxUpdate", resp);
    //     } catch (error) {
    //       console.error(error);
    //       logger.error(error);
    //     }
    //   }
    // });

    const claimTreasureBoxRewardLevel = async (roomId, level) => {
      const claimedRoom = await models.Room.findOneAndUpdate(
        {
          _id: roomId,
          treasureBoxLevel: { $gte: level },
          lastGiftedTreasureBoxLevel: level - 1,
        },
        {
          $set: {
            lastGiftedTreasureBoxLevel: level,
            [`treasureBoxLevelOpenTimes.${level}`]: new Date(), // Track when this level was opened
          },
        },
        {
          new: true,
          projection: {
            _id: 1,
            treasureBoxLevel: 1,
            lastGiftedTreasureBoxLevel: 1,
            treasureBoxLevelOpenTimes: 1,
          },
        },
      );

      return Boolean(claimedRoom);
    };

    const queueTreasureBoxReward = (notificationMap, userId, rewardPayload) => {
      if (!notificationMap) {
        return;
      }

      const userKey = userId.toString();
      const existingRewards = notificationMap.get(userKey) || [];
      existingRewards.push(rewardPayload);
      notificationMap.set(userKey, existingRewards);
    };

    const emitQueuedTreasureBoxRewards = async (
      roomId,
      notificationMap,
      lastGiftDetails,
    ) => {
      const roomData = await models.Room.findById(roomId, {
        treasureBoxLevelWiseWinners: 1,
      }).lean();

      const levelWiseWinnersRaw = roomData?.treasureBoxLevelWiseWinners || {};
      const levelWiseWinners =
        levelWiseWinnersRaw instanceof Map
          ? Object.fromEntries(levelWiseWinnersRaw)
          : { ...levelWiseWinnersRaw };

      for (const [userId, rewards] of notificationMap.entries()) {
        if (!rewards.length) {
          continue;
        }

        const levelList = [
          ...new Set(
            rewards
              .map((reward) => reward.treasureBoxLevel)
              .filter((level) => level !== undefined),
          ),
        ].sort((a, b) => a - b);

        const flattenedItems = rewards.flatMap((reward) => {
          if (Array.isArray(reward.items)) {
            return reward.items;
          }

          if (reward.item) {
            return [reward.item];
          }

          if (reward.rewardItem) {
            return [reward.rewardItem];
          }

          return [];
        });

        const winnerIds = Array.from(
          new Set(
            levelList.flatMap((level) => {
              const levelKey = String(level);
              const levelWinners = Array.isArray(levelWiseWinners[levelKey])
                ? levelWiseWinners[levelKey]
                : [];

              return levelWinners
                .map((winner) => {
                  if (winner && typeof winner === "object" && winner.userId) {
                    return winner.userId.toString();
                  }

                  return winner?.toString();
                })
                .filter(Boolean);
            }),
          ),
        );

        const winnerCustomers = winnerIds.length
          ? await models.Customer.find(
              { _id: { $in: winnerIds } },
              {
                _id: 1,
                userId: 1,
                name: 1,
                profileImage: 1,
                level: 1,
                countryCode: 1,
              },
            ).lean()
          : [];

        const winnerCustomerMap = new Map(
          winnerCustomers.map((customer) => [
            customer._id.toString(),
            {
              _id: customer._id,
              userId: customer.userId,
              name: customer.name,
              profileImage: customer.profileImage,
              level: customer.level,
              countryCode: customer.countryCode,
            },
          ]),
        );

        const levelRewards = levelList.map((level) => {
          const rewardsForLevel = rewards.filter(
            (reward) => reward.treasureBoxLevel === level,
          );

          const levelKey = String(level);
          const top3WinnersRaw = Array.isArray(levelWiseWinners[levelKey])
            ? levelWiseWinners[levelKey]
            : [];

          const top3Customers = top3WinnersRaw
            .map((winner, index) => {
              const winnerUserId =
                winner && typeof winner === "object" && winner.userId
                  ? winner.userId.toString()
                  : winner?.toString();

              const winnerUser = winnerUserId
                ? winnerCustomerMap.get(winnerUserId)
                : null;

              if (!winnerUser) {
                return null;
              }

              return {
                rank: index + 1,
                wonAt: winner?.wonAt || null,
                diamondGifted: Number(winner?.diamondGifted || 0),
                customer: winnerUser,
              };
            })
            .filter(Boolean);

          const normalizedRewards = rewardsForLevel.map((reward) => {
            if (Array.isArray(reward.items)) {
              return {
                rewardType: "bundle",
                message: reward.message,
                items: reward.items,
              };
            }

            if (reward.item) {
              return {
                rewardType: "item",
                message: reward.message,
                item: reward.item,
              };
            }

            if (reward.rewardItem) {
              return {
                rewardType: "attribute",
                message: reward.message,
                item: reward.rewardItem,
              };
            }

            return {
              rewardType: "message",
              message: reward.message,
            };
          });

          const levelItems = normalizedRewards.flatMap((reward) => {
            if (Array.isArray(reward.items)) {
              return reward.items;
            }

            if (reward.item) {
              return [reward.item];
            }

            return [];
          });

          return {
            level,
            top3Customers,
            rewards: normalizedRewards,
            items: levelItems,
          };
        });

        io.to(userId).emit("treasureBoxItem", {
          type: "treasureBoxRewardBatch",
          summary: {
            message:
              levelList.length > 1
                ? `You received treasure box rewards for levels ${levelList.join(", ")}!`
                : rewards[rewards.length - 1]?.message ||
                  "You received a treasure box reward!",
            levels: levelList,
            totalRewards: rewards.length,
            totalItems: flattenedItems.length,
          },
          levelRewards,
          lastGiftDetails,
          roomId,
        });
      }
    };

    const processPendingTreasureBoxRewards = async (
      roomId,
      lastGiftDetails,
      rewardWindow = null,
      maxIterations = 20,
    ) => {
      const notificationMap = new Map();
      let hitIterationLimit = true;

      for (let attempt = 0; attempt < maxIterations; attempt++) {
        const roomSnapshot = await models.Room.findById(roomId, {
          treasureBoxLevel: 1,
          lastGiftedTreasureBoxLevel: 1,
        }).lean();

        if (!roomSnapshot) {
          logger.warn(
            `Room ${roomId} not found while processing pending treasure box rewards`,
          );
          return;
        }

        const lastGiftedLevel = roomSnapshot.lastGiftedTreasureBoxLevel || 0;
        const currentLevel = roomSnapshot.treasureBoxLevel || 0;
        const nextPendingLevel = lastGiftedLevel + 1;

        if (nextPendingLevel > currentLevel) {
          hitIterationLimit = false;
          break;
        }

        const isLevelClaimed = await claimTreasureBoxRewardLevel(
          roomId,
          nextPendingLevel,
        );

        if (!isLevelClaimed) {
          // Another concurrent request is processing this level; retry from fresh DB state.
          continue;
        }

        console.log(
          `Processing treasure box rewards for level ${nextPendingLevel}...`,
        );

        await giftRandomShopItemInRoom(
          roomId,
          {
            ...lastGiftDetails,
            treasureBoxLevel: nextPendingLevel,
          },
          nextPendingLevel,
          notificationMap,
          rewardWindow,
        );
      }

      await emitQueuedTreasureBoxRewards(
        roomId,
        notificationMap,
        lastGiftDetails,
      );

      if (hitIterationLimit) {
        logger.warn(
          `Stopped processing treasure box rewards for room ${roomId} after ${maxIterations} iterations`,
        );
      }
    };

    const giftRandomShopItemInRoom = async (
      roomId,
      lastGiftDetails,
      targetLevel = null,
      notificationMap = null,
      rewardWindow = null,
    ) => {
      if (!roomId) {
        return {
          success: false,
          message: "roomId is required to gift random shop item",
        };
      }

      try {
        const room = await models.Room.findById(roomId).lean();
        if (!room) {
          return {
            success: false,
            message: "room not found",
          };
        }

        // const userIds = room.groupMembers;
        // userIds is combination of activeUsers, lastMembers
        // Convert ObjectIds to strings, deduplicate, then convert back to ObjectIds
        let userIds = Array.from(
          new Set(
            [...(room.activeUsers || []), ...(room.lastMembers || [])].map(
              (id) => id.toString(),
            ),
          ),
        ).map((id) => new mongoose.Types.ObjectId(id)); // Combine and deduplicate user IDs

        console.log("userIds===========>", userIds);

        // Already deduplicated above, no need to do it again

        console.log("userIds after remove duplicates ===========>", userIds);

        // Use targetLevel if provided, otherwise use room's current level
        const currentLevel =
          targetLevel !== null ? targetLevel : room.treasureBoxLevel || 1;

        const itemsLevelWise = await models.TreasureBoxLevel.findOne({
          level: currentLevel,
        }).lean();

        if (!itemsLevelWise) {
          return {
            success: false,
            message: "Treasure box items not found for the current level",
          };
        }

        // Level-wise contribution window:
        // For level N, count gifts from when level N-1 was opened until when level N was opened.
        // This ensures each level's top-3 are only based on gifts that unlocked THAT specific level.
        let levelWindowStartBase;
        let levelWindowEndBase;

        // Check if previous level's open time is recorded (priority: stable reward trigger window)
        const levelOpenTimes = room.treasureBoxLevelOpenTimes || {};
        const previousLevel = currentLevel - 1;

        // During pending-level processing, use one stable trigger window for all levels.
        // This avoids claim-time millisecond windows that undercount contributors.
        if (rewardWindow?.start && rewardWindow?.end) {
          levelWindowStartBase = new Date(rewardWindow.start);
          levelWindowEndBase = new Date(rewardWindow.end);
        } else {
          // Exact start for current level = when previous level got opened.
          if (previousLevel > 0 && levelOpenTimes[previousLevel]) {
            levelWindowStartBase = new Date(levelOpenTimes[previousLevel]);
          } else if (previousLevel > 0) {
            // Backward compatibility: if direct previous is missing, search nearest lower known level time.
            let nearestKnownStart = null;
            for (let lvl = previousLevel - 1; lvl >= 1; lvl--) {
              if (levelOpenTimes[lvl]) {
                nearestKnownStart = new Date(levelOpenTimes[lvl]);
                break;
              }
            }

            levelWindowStartBase =
              nearestKnownStart ||
              room.treasureBoxLevelUpdatedAt ||
              new Date(new Date().setHours(0, 0, 0, 0));
          } else {
            // Level 1 start comes from stable room-level marker.
            levelWindowStartBase =
              room.treasureBoxLevelUpdatedAt ||
              new Date(new Date().setHours(0, 0, 0, 0));
          }

          // Window END: use the current level open datetime, otherwise use now.
          if (currentLevel > 0 && levelOpenTimes[currentLevel]) {
            levelWindowEndBase = new Date(levelOpenTimes[currentLevel]);
          } else {
            levelWindowEndBase = new Date();
          }
        }

        // Guard against invalid/narrow windows when timestamps are partially missing.
        if (
          new Date(levelWindowEndBase).getTime() <=
          new Date(levelWindowStartBase).getTime()
        ) {
          levelWindowStartBase =
            rewardWindow?.start ||
            room.treasureBoxLevelUpdatedAt ||
            new Date(new Date().setHours(0, 0, 0, 0));
        }

        // Small buffer protects against millisecond timing gaps between write and read.
        const levelWindowStart = new Date(
          new Date(levelWindowStartBase).getTime() - 2000,
        );
        const levelWindowEnd = levelWindowEndBase;

        const userDiamondsMap = new Map();
        for (const userId of userIds) {
          // Level-wise diamonds by room/sender/time window.
          // Use SendGift because it always has roomId.
          const totalDiamonds = await models.SendGift.aggregate([
            {
              $match: {
                roomId: new mongoose.Types.ObjectId(roomId),
                sender: new mongoose.Types.ObjectId(userId),
                createdAt: {
                  $gte: levelWindowStart,
                  $lte: levelWindowEnd,
                },
              },
            },
            {
              $group: {
                _id: "$sender",
                total: { $sum: { $multiply: ["$gift.diamonds", "$count"] } },
              },
            },
          ]);

          userDiamondsMap.set(userId, Number(totalDiamonds[0]?.total || 0));
        }

        // Sort users by diamond amount in descending order
        const sortedUsers = Array.from(userDiamondsMap.entries()).sort(
          (a, b) => b[1] - a[1],
        );

        // Assign levels to users
        const userLevels = new Map();
        for (let i = 0; i < sortedUsers.length; i++) {
          if (i === 0) {
            userLevels.set(sortedUsers[i][0], 1);
          } else if (i < 3) {
            userLevels.set(sortedUsers[i][0], 2);
          } else {
            userLevels.set(sortedUsers[i][0], 3);
          }
        }

        // push or update treasure box level-wise winners in room document
        // Note: room is fetched with .lean(), so this field is a plain object, not a Map.
        const levelWiseWinnersRaw = room.treasureBoxLevelWiseWinners || {};
        const levelWiseWinners =
          levelWiseWinnersRaw instanceof Map
            ? Object.fromEntries(levelWiseWinnersRaw)
            : { ...levelWiseWinnersRaw };

        const levelKey = String(currentLevel);
        const existingTop3 = Array.isArray(levelWiseWinners[levelKey])
          ? levelWiseWinners[levelKey]
          : [];

        const existingWinnerMap = new Map(
          existingTop3
            .map((winner) => {
              // Backward compatibility for old schema values (plain ObjectId arrays)
              if (winner && typeof winner === "object" && winner.userId) {
                return [winner.userId.toString(), winner];
              }
              return [winner?.toString(), null];
            })
            .filter(([id]) => Boolean(id)),
        );

        // Build level-wise winners with new schema shape.
        const top3Users = sortedUsers.slice(0, 3).map(([userId, gifted]) => {
          const userIdStr = userId.toString();
          const existingWinner = existingWinnerMap.get(userIdStr);

          return {
            userId: new mongoose.Types.ObjectId(userIdStr),
            wonAt: existingWinner?.wonAt || new Date(),
            // Strictly store level-window gifted amount for this rank snapshot.
            diamondGifted: Number(gifted ?? 0),
          };
        });

        console.log(
          `Updating treasure box level-wise winners for level ${currentLevel} :`,
          top3Users,
        );

        // Update only the current level key to avoid clobbering winners
        // from other levels during concurrent reward processing.
        await models.Room.updateOne(
          { _id: roomId },
          {
            $set: {
              [`treasureBoxLevelWiseWinners.${levelKey}`]: top3Users,
            },
          },
        );

        // Gift items based on levels
        for (const userId of userIds) {
          const isUserExists = await models.Customer.findById(userId);

          if (!isUserExists) {
            logger.warn(
              `Skipping gifting because user ${userId} was not found`,
            );
            continue;
          }

          const level = userLevels.get(userId);

          // give better luck next time message to random users it can be top 3 or others based on random selection, so that not every user gets item as a gift to make it more exciting.

          const randomUser = Math.random();
          if (randomUser < 0.3 && ![1, 2, 3].includes(level)) {
            // 30% chance to not gift anything to a user
            queueTreasureBoxReward(notificationMap, userId, {
              message: "Better luck next time!",
              treasureBoxLevel: currentLevel,
              lastGiftDetails,
            });

            if (!notificationMap) {
              io.to(userId).emit("treasureBoxItem", {
                message: "Better luck next time!",
                treasureBoxLevel: currentLevel,
                lastGiftDetails,
                roomId,
              });
            }
            continue;
          }

          const items = level
            ? itemsLevelWise[`person${level}Items`]
            : itemsLevelWise["otherItems"];
          if (items && items.length > 0) {
            // const randomItem = items[Math.floor(Math.random() * items.length)];

            // change in the logic is for top 1 user give all person1Items, for top 2 give all person2Items and for top 3 give all person3Items and for others give any 1 random item from  otherItems, to make it more exciting and rewarding for top users.

            if (level === 1 || level === 2 || level === 3) {
              const levelItems = itemsLevelWise[`person${level}Items`];
              let giftedItems = [];

              for (let randomItem of levelItems) {
                if (randomItem.itemId) {
                  // If it is Shop item

                  const itemData = await models.ShopItem.findById(
                    randomItem.itemId,
                  ).lean();

                  const finalItemdata = {
                    isDefault: false,
                    isOfficial: false,
                    itemType: itemData.itemType,
                    name: itemData.name,
                    resource: itemData.resource,
                    thumbnail: itemData.thumbnail,
                    _id: itemData._id,
                    validTill: new Date(
                      Date.now() + randomItem.validTill * 24 * 60 * 60 * 1000,
                    ),
                  };

                  const itemType = `${finalItemdata.itemType}s`;

                  const user = await models.Customer.findById(userId)
                    .select(`${itemType}`)
                    .lean();

                  // Filter out the existing item by _id
                  const existingUserItems = Array.isArray(user?.[itemType])
                    ? user[itemType]
                    : [];

                  const filteredItems = existingUserItems.filter(
                    (i) => !i._id.equals(finalItemdata._id),
                  );

                  // Add the new item
                  filteredItems.push(finalItemdata);

                  // Replace the entire array with filtered + new item
                  await models.Customer.updateOne(
                    { _id: userId },
                    { $set: { [itemType]: filteredItems } },
                  );

                  giftedItems.push(finalItemdata);
                } else if (randomItem.diamondAmount) {
                  // If it is diamond gift

                  await models.Customer.updateOne(
                    { _id: userId },
                    { $inc: { diamonds: randomItem.diamondAmount } },
                  );

                  randomItem.image =
                    "https://usefun-uploads.s3.ap-south-1.amazonaws.com/1000089129-removebg-preview.png";
                  giftedItems.push(randomItem);
                } else if (randomItem.beansAmount) {
                  // If it is bean gift

                  await models.Customer.updateOne(
                    { _id: userId },
                    { $inc: { beans: randomItem.beansAmount } },
                  );

                  randomItem.image =
                    "https://usefun-uploads.s3.ap-south-1.amazonaws.com/beans.png";

                  giftedItems.push(randomItem);
                } else if (randomItem.xp) {
                  // If it is xp gift
                  const user = await models.Customer.findById(userId)
                    .select("xp")
                    .lean();

                  await models.Customer.updateOne(
                    { _id: userId },
                    { $set: { xp: Number(user.xp || 0) + randomItem.xp } },
                  );

                  randomItem.image =
                    "https://usefun-uploads.s3.ap-south-1.amazonaws.com/1000089358-removebg-preview.png";

                  giftedItems.push(randomItem);
                }
              }

              queueTreasureBoxReward(notificationMap, userId, {
                message: "You have received bundle a gift!",
                items: giftedItems,
                treasureBoxLevel: currentLevel,
                lastGiftDetails,
              });

              if (!notificationMap) {
                io.to(userId.toString()).emit("treasureBoxItem", {
                  message: "You have received bundle a gift!",
                  items: giftedItems,
                  treasureBoxLevel: currentLevel,
                  lastGiftDetails,
                  roomId,
                });
              }
            } else {
              const randomItem =
                items[Math.floor(Math.random() * items.length)];

              if (randomItem.itemId) {
                // If it is Shop item

                const itemData = await models.ShopItem.findById(
                  randomItem.itemId,
                ).lean();

                const finalItemdata = {
                  isDefault: false,
                  isOfficial: false,
                  itemType: itemData.itemType,
                  name: itemData.name,
                  resource: itemData.resource,
                  thumbnail: itemData.thumbnail,
                  _id: itemData._id,
                  validTill: new Date(
                    Date.now() + randomItem.validTill * 24 * 60 * 60 * 1000,
                  ),
                };

                const itemType = `${finalItemdata.itemType}s`;

                const user = await models.Customer.findById(userId)
                  .select(`${itemType}`)
                  .lean();

                // Filter out the existing item by _id
                const existingUserItems = Array.isArray(user?.[itemType])
                  ? user[itemType]
                  : [];

                const filteredItems = existingUserItems.filter(
                  (i) => !i._id.equals(finalItemdata._id),
                );

                // Add the new item
                filteredItems.push(finalItemdata);

                // Replace the entire array with filtered + new item
                await models.Customer.updateOne(
                  { _id: userId },
                  { $set: { [itemType]: filteredItems } },
                );

                queueTreasureBoxReward(notificationMap, userId, {
                  item: finalItemdata,
                  message: `You have received a ${finalItemdata.name} as a gift!`,
                  treasureBoxLevel: currentLevel,
                  lastGiftDetails,
                });

                if (!notificationMap) {
                  io.to(userId.toString()).emit("treasureBoxItem", {
                    item: finalItemdata,
                    message: `You have received a ${finalItemdata.name} as a gift!`,
                    treasureBoxLevel: currentLevel,
                    lastGiftDetails,
                    roomId,
                  });
                }
              } else if (randomItem.diamondAmount) {
                // If it is diamond gift

                await models.Customer.updateOne(
                  { _id: userId },
                  { $inc: { diamonds: randomItem.diamondAmount } },
                );

                queueTreasureBoxReward(notificationMap, userId, {
                  message: `You have received ${randomItem.diamondAmount} diamonds as a gift!`,
                  rewardItem: {
                    ...randomItem,
                    image:
                      "https://usefun-uploads.s3.ap-south-1.amazonaws.com/1000089129-removebg-preview.png",
                    treasureBoxLevel: currentLevel,
                  },
                  treasureBoxLevel: currentLevel,
                  lastGiftDetails,
                });

                if (!notificationMap) {
                  io.to(userId.toString()).emit("treasureBoxItem", {
                    message: `You have received ${randomItem.diamondAmount} diamonds as a gift!`,
                    image:
                      "https://usefun-uploads.s3.ap-south-1.amazonaws.com/1000089129-removebg-preview.png",
                    treasureBoxLevel: currentLevel,
                    lastGiftDetails,
                    roomId,
                  });
                }
              } else if (randomItem.beansAmount) {
                // If it is bean gift

                await models.Customer.updateOne(
                  { _id: userId },
                  { $inc: { beans: randomItem.beansAmount } },
                );

                queueTreasureBoxReward(notificationMap, userId, {
                  message: `You have received ${randomItem.beansAmount} beans as a gift!`,
                  rewardItem: {
                    ...randomItem,
                    image:
                      "https://usefun-uploads.s3.ap-south-1.amazonaws.com/beans.png",
                    treasureBoxLevel: currentLevel,
                  },
                  treasureBoxLevel: currentLevel,
                  lastGiftDetails,
                });

                if (!notificationMap) {
                  io.to(userId.toString()).emit("treasureBoxItem", {
                    message: `You have received ${randomItem.beansAmount} beans as a gift!`,
                    image:
                      "https://usefun-uploads.s3.ap-south-1.amazonaws.com/beans.png",
                    treasureBoxLevel: currentLevel,
                    lastGiftDetails,
                    roomId,
                  });
                }
              } else if (randomItem.xp) {
                // If it is xp gift

                const user = await models.Customer.findById(userId)
                  .select("xp")
                  .lean();

                await models.Customer.updateOne(
                  { _id: userId },
                  { $set: { xp: Number(user.xp || 0) + randomItem.xp } },
                );

                queueTreasureBoxReward(notificationMap, userId, {
                  message: `You have received ${randomItem.xp} EXP as a gift!`,
                  rewardItem: {
                    ...randomItem,
                    image:
                      "https://usefun-uploads.s3.ap-south-1.amazonaws.com/1000089358-removebg-preview.png",
                    treasureBoxLevel: currentLevel,
                  },
                  treasureBoxLevel: currentLevel,
                  lastGiftDetails,
                });

                if (!notificationMap) {
                  io.to(userId.toString()).emit("treasureBoxItem", {
                    message: `You have received ${randomItem.xp} EXP as a gift!`,
                    image:
                      "https://usefun-uploads.s3.ap-south-1.amazonaws.com/1000089358-removebg-preview.png",
                    treasureBoxLevel: currentLevel,
                    lastGiftDetails,
                    roomId,
                  });
                }
              }
            }
          }
        }

        console.log(
          `Random shop items gifted to users in room ${roomId} based on their levels`,
        );

        // If no items were gifted to any user, send a "Better luck next time" message
        if (userLevels.size === 0) {
          return {
            success: true,
            message: "Better luck next time",
          };
        }

        return {
          success: true,
          message:
            "Random shop items gifted successfully based on user levels in the room.",
        };
      } catch (error) {
        logger.error(error);
        return { success: false, message: error.message };
      }
    };

    socket.on("sendGift", async (data) => {
      const { sender, receiver, giftId, count, qtyId } = data;

      if (
        socket.data.userId &&
        socket.data.roomId &&
        sender &&
        receiver &&
        giftId &&
        qtyId
      ) {
        try {
          const roomId = socket.data.roomId;

          // ✅ Fetch quantity cashback
          const quantityData = await models.QuantityCashback.findById(qtyId);
          if (!quantityData) {
            console.warn("❌ Invalid quantity ID:", qtyId);
            io.to(sender).emit("errorMessage", {
              success: false,
              message: "Invalid quantity ID",
            });
            return;
          }
          const { quantity, cashbackAmount } = quantityData;

          // ✅ Fetch gift
          const selectedGift =
            await models.Gift.findById(giftId).populate("categoryId");
          if (!selectedGift) {
            console.warn("❌ Gift not found:", giftId);
            io.to(sender).emit("errorMessage", {
              success: false,
              message: "Gift not found",
            });
            return;
          }

          const categoryName =
            selectedGift.categoryId?.name?.toLowerCase() ||
            selectedGift.categoryId?.toLowerCase();
          const totalGiftDiamonds = selectedGift.diamonds * quantity;

          // ✅ Fetch customers (sender + receiver)
          const [senderC, receiverC] = await Promise.all([
            models.Customer.findById(sender),
            models.Customer.findById(receiver),
          ]);

          if (!senderC || !receiverC) {
            console.warn("❌ Sender or receiver not found:", {
              sender,
              receiver,
            });
            io.to(sender).emit("errorMessage", {
              success: false,
              message: "Sender or receiver not found",
            });
            return;
          }

          // ✅ Diamond balance check
          if (senderC.diamonds < totalGiftDiamonds) {
            console.warn("❌ Not enough diamonds", {
              available: senderC.diamonds,
              required: totalGiftDiamonds,
            });
            io.to(sender).emit("errorMessage", {
              success: false,
              message: "Not enough diamonds to send this gift",
              availableDiamonds: senderC.diamonds,
              requiredDiamonds: totalGiftDiamonds,
            });
            return;
          }

          // 🎁 Surprise Gift Logic
          let actualReceiverBeans = totalGiftDiamonds;
          let senderCashback = 0;

          if (categoryName === "surprise") {
            // console.log("🎲 Surprise gift detected, applying special logic...");
            // actualReceiverBeans = Math.floor(totalGiftDiamonds / 2);

            // const shouldGiveCashback = Math.random() < 0.3;
            // console.log(
            //   `🎲 Cashback chance triggered: ${
            //     shouldGiveCashback ? "YES" : "NO"
            //   }`
            // );

            // if (shouldGiveCashback) {
            //   const now = new Date();
            //   const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

            //   console.log("📊 Aggregating GiftTransactions in last 5 mins...");
            //   const transactions = await models.GiftTransaction.aggregate([
            //     {
            //       $match: {
            //         countryCode: senderC.countryCode,
            //         giftTime: { $gte: fiveMinutesAgo, $lte: now },
            //       },
            //     },
            //     {
            //       $group: {
            //         _id: null,
            //         totalDiamonds: { $sum: "$totalDiamonds" },
            //       },
            //     },
            //   ]);

            //   const recentTotal = transactions?.[0]?.totalDiamonds || 0;
            //   const maxCashback = Math.floor(recentTotal * 0.1);
            //   senderCashback = Math.floor(Math.random() * (maxCashback + 1));

            //   console.log(
            //     `💰 Cashback granted: ${senderCashback} (Recent total: ${recentTotal}, Max: ${maxCashback})`
            //   );
            // }

            if (totalGiftDiamonds >= 199) {
              let cashbackOptions = [];

              if (totalGiftDiamonds >= 1000) {
                cashbackOptions = [
                  Math.floor(totalGiftDiamonds * 0.199),
                  Math.floor(totalGiftDiamonds * 0.399),
                  Math.floor(totalGiftDiamonds * 0.01),
                  0,
                ];
              } else {
                cashbackOptions = [1, 10, 0];
              }

              const randomIndex = Math.floor(
                Math.random() * cashbackOptions.length,
              );
              senderCashback = cashbackOptions[randomIndex];

              console.log(`Surprise Gift Logic:
          Total Gift Diamonds: ${totalGiftDiamonds}
          Cashback Options: ${cashbackOptions.join(", ")}
          Selected Cashback: ${senderCashback}
         `);
            }
          }

          // ✅ Update sender balance
          senderC.diamonds += senderCashback - totalGiftDiamonds;
          senderC.usedDiamonds += totalGiftDiamonds;
          senderC.xp = (
            BigInt(senderC.xp) + BigInt(totalGiftDiamonds)
          ).toString();
          senderC.level = getUserLevel(BigInt(senderC.xp));
          await senderC.save();

          // ✅ Update receiver beans
          receiverC.beans += actualReceiverBeans;
          await receiverC.save();

          // ✅ Save SendGift + GiftTransaction + History
          await Promise.all([
            models.SendGift.create({
              roomId,
              sender,
              receiver,
              count: quantity,
              gift: selectedGift,
            }),
            models.GiftTransaction.create({
              sender,
              receiver,
              gift: selectedGift._id,
              totalDiamonds: actualReceiverBeans,
              countryCode: senderC.countryCode,
              giftTime: new Date(),
            }),
            models.UserDiamondHistory.create([
              {
                userId: sender,
                diamonds: totalGiftDiamonds,
                type: 1,
                uses: "Gift",
              },
              ...(senderCashback > 0
                ? [
                    {
                      userId: sender,
                      diamonds: senderCashback,
                      type: 2,
                      uses: "Cashback Rewards",
                    },
                  ]
                : []),
            ]),
          ]);

          // ✅ Update TreasureBox totals atomically to avoid race conditions.
          // `treasureBoxCurrentLevelDiamonds` tracks only the spend inside the active level window.
          const room = await models.Room.findOneAndUpdate(
            { _id: roomId },
            {
              $inc: {
                diamondsUsedToday: totalGiftDiamonds,
                treasureBoxCurrentLevelDiamonds: totalGiftDiamonds,
                diamondsUsedCurrentSeason: totalGiftDiamonds,
                totalDiamondsUsed: totalGiftDiamonds,
              },
            },
            {
              new: true,
              projection: {
                _id: 1,
                name: 1,
                roomImage: 1,
                diamondsUsedToday: 1,
                treasureBoxCurrentLevelDiamonds: 1,
                diamondsUsedCurrentSeason: 1,
                totalDiamondsUsed: 1,
                treasureBoxLevel: 1,
                treasureBoxLevelProgress: 1,
                treasureBoxLevelUpdatedAt: 1,
              },
            },
          );

          const previousLevel = Number(room.treasureBoxLevel || 0);
          const treasureBoxState = await getTreasureBoxState({
            currentLevel: previousLevel,
            currentLevelDiamonds: Number(
              room.treasureBoxCurrentLevelDiamonds || 0,
            ),
          });
          const calculatedLevel = treasureBoxState.level;
          const isLevelChanged = calculatedLevel > previousLevel;

          // update treasure box state based on diamonds spent inside the current level only
          room.treasureBoxLevel = calculatedLevel;
          room.treasureBoxCurrentLevelDiamonds =
            treasureBoxState.remainingDiamonds;
          room.treasureBoxLevelProgress = treasureBoxState.progress;

          const rewardWindowStart =
            room.treasureBoxLevelUpdatedAt ||
            new Date(new Date().setHours(0, 0, 0, 0));
          const rewardWindowEnd = new Date();

          const rewardTriggeredAt = isLevelChanged
            ? rewardWindowEnd
            : room.treasureBoxLevelUpdatedAt;

          await models.Room.updateOne(
            { _id: roomId },
            {
              $set: {
                treasureBoxLevel: room.treasureBoxLevel,
                treasureBoxCurrentLevelDiamonds:
                  room.treasureBoxCurrentLevelDiamonds,
                treasureBoxLevelProgress: room.treasureBoxLevelProgress,
                ...(isLevelChanged
                  ? { treasureBoxLevelUpdatedAt: rewardTriggeredAt }
                  : {}),
              },
            },
          );

          // if level up happened, process pending levels sequentially so none are skipped in concurrent bursts
          if (isLevelChanged) {
            console.log(
              `Treasure Box Level Up! Previous: ${previousLevel}, New: ${room.treasureBoxLevel}. Processing pending treasure box rewards...`,
            );

            await processPendingTreasureBoxRewards(
              roomId,
              {
                senderC,
                receiverC,
                selectedGift,
              },
              {
                start: rewardWindowStart,
                end: rewardWindowEnd,
              },
            );
          }

          // ✅ Emit sender updated data
          const userData = await models.Customer.findById(socket.data.userId);
          io.to(socket.data.userId).emit("userDataUpdate", userData);

          // ✅ Emit giftSent to all rooms in sender’s country
          const allRooms = await models.Room.find(
            { countryCode: senderC.countryCode },
            { _id: 1 },
          );

          allRooms.forEach((r) => {
            io.to(r._id.toString()).emit("giftSent", {
              senderId: sender,
              receiverId: receiver,
              roomId,
              roomName: room?.name || "",
              roomImage: room?.roomImage || "",
              senderName: senderC?.name || "",
              senderProfileImage: senderC?.profileImage || "",
              receiverName: receiverC?.name || "",
              receiverProfileImage: receiverC?.profileImage || "",
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
          });

          // ✅ Emit diamond update
          io.to(sender).emit("diamondUpdate", {
            userId: sender,
            totalDiamonds: senderC.diamonds,
            receivedCashbackDiamonds: senderCashback,
          });

          // ✅ Emit bean update
          io.to(receiver).emit("beanUpdate", {
            userId: receiver,
            totalBeans: receiverC.beans,
            receivedBeans: actualReceiverBeans,
          });

          // ✅ Emit treasure box update
          io.to(roomId).emit("treasureBoxUpdate", {
            diamondsUsedToday: room.diamondsUsedToday,
            treasureBoxLevel: room.treasureBoxLevel,
            totalDiamondsUsed: room.totalDiamondsUsed,
            diamondsUsedCurrentSeason: room.diamondsUsedCurrentSeason,
            treasureBoxLevelProgress: room.treasureBoxLevelProgress,
          });

          // ✅ Emit giftUpdate
          io.to(roomId).emit("giftUpdate", {
            receiver,
            giftId,
            count,
            sender,
            points: selectedGift.diamonds,
          });
        } catch (error) {
          console.error("❌ Error in sendGift socket:", error);
          io.to(sender).emit("errorMessage", {
            success: false,
            message: "Internal server error",
            error: error.message,
          });
        }
      }
    });
  });

  // Function to find Level using Xp Value
  const getUserLevel = (currentXP) => {
    // Linear search - more efficient for early levels
    for (let level = 0; level < xpSeries.length; level++) {
      if (currentXP < xpSeries[level]) {
        return level - 1;
      }
    }

    return xpSeries.length - 1;
  };

  const getTreasureBoxState = async ({
    currentLevel = 0,
    currentLevelDiamonds = 0,
  }) => {
    const levels = await models.TreasureBoxLevel.find({})
      .sort({ level: 1 })
      .lean();

    if (!levels.length) {
      return {
        level: 0,
        remainingDiamonds: 0,
        progress: 0,
      };
    }

    let resolvedLevel = Number(currentLevel || 0);
    let remainingDiamonds = Number(currentLevelDiamonds || 0);

    while (true) {
      const nextLevelConfig = levels.find(
        (levelConfig) => Number(levelConfig.level || 0) === resolvedLevel + 1,
      );

      if (!nextLevelConfig) {
        return {
          level: resolvedLevel,
          remainingDiamonds,
          progress: 100,
        };
      }

      const requiredDiamonds = Number(nextLevelConfig.diamondToOpen || 0);
      if (requiredDiamonds <= 0) {
        resolvedLevel = Number(nextLevelConfig.level || resolvedLevel);
        continue;
      }

      if (remainingDiamonds < requiredDiamonds) {
        return {
          level: resolvedLevel,
          remainingDiamonds,
          progress: Math.min(
            100,
            Math.max(0, (remainingDiamonds / requiredDiamonds) * 100),
          ),
        };
      }

      remainingDiamonds -= requiredDiamonds;
      resolvedLevel = Number(nextLevelConfig.level || resolvedLevel);
    }
  };
};

module.exports = { configure };
