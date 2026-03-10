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

    const giftRandomShopItemInRoom = async (roomId, lastGiftDetails) => {
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

        const currentLevel = room.treasureBoxLevel || 1; // Assuming currentLevel is stored in the room document

        const itemsLevelWise = await models.TreasureBoxLevel.findOne({
          level: currentLevel,
        }).lean();

        if (!itemsLevelWise) {
          return {
            success: false,
            message: "Treasure box items not found for the current level",
          };
        }

        const userDiamondsMap = new Map();
        for (const userId of userIds) {
          // use models.GiftTransaction to calculate total diamonds gifted by each user in the room by today date.
          const totalDiamonds = await models.GiftTransaction.aggregate([
            {
              $match: {
                roomId: new mongoose.Types.ObjectId(roomId),
                sender: new mongoose.Types.ObjectId(userId),
                createdAt: {
                  $gte:
                    room.treasureBoxLevelUpdatedAt ||
                    new Date(new Date().setHours(0, 0, 0, 0)), // treasureBoxLevelUpdatedAt
                  $lte: new Date(new Date().setHours(23, 59, 59, 999)), // End of today
                },
              },
            },
            { $group: { _id: "$sender", total: { $sum: "$totalDiamonds" } } },
          ]);

          userDiamondsMap.set(userId, totalDiamonds[0]?.total || 0);
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

        // push or update reasure box level wise winners in room document based on the room top 3 users who gifted the most diamonds in the room for the current treasure box level
        let levelWiseWinners = room.treasureBoxLevelWiseWinners || new Map();

        let top3Users = levelWiseWinners.get(currentLevel) || [];

        // Add new winners to the existing list and remove duplicates
        top3Users = Array.from(
          new Set([
            ...top3Users,
            ...sortedUsers.slice(0, 3).map((u) => u[0].toString()),
          ]),
        ).map((id) => new mongoose.Types.ObjectId(id));
        levelWiseWinners.set(currentLevel, top3Users);
        await models.Room.updateOne(
          { _id: roomId },
          { $set: { treasureBoxLevelWiseWinners: levelWiseWinners } },
        );

        // Gift items based on levels
        for (const userId of userIds) {
          // give better luck next time message to random users it can be top 3 or others based on random selection, so that not every user gets item as a gift to make it more exciting.

          const randomUser = Math.random();
          if (randomUser < 0.3) {
            // 30% chance to not gift anything to a user
            io.to(userId).emit("treasureBoxItem", {
              message: "Better luck next time!",
              lastGiftDetails,
            });
            continue;
          }

          const level = userLevels.get(userId);

          const items = level
            ? itemsLevelWise[`person${level}Items`]
            : itemsLevelWise["otherItems"];
          if (items && items.length > 0) {
            // const randomItem = items[Math.floor(Math.random() * items.length)];

            // change in the logic is for top 1 user give all person1Items, for top 2 give all person2Items and for top 3 give all person3Items and for others give any 1 random item from  otherItems, to make it more exciting and rewarding for top users.

            if (level === 1 || level === 2 || level === 3) {
              const levelItems = itemsLevelWise[`person${level}Items`];
              let giftedItems = [];

              io.to(userId.toString()).emit("test123", {
                message: "Test123",
                lastGiftDetails,
              });

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
                  const filteredItems = user[itemType].filter(
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

              io.to(userId.toString()).emit("test123", {
                message: "Test123",
                lastGiftDetails,
              });
              // console.log(`Gifted items to user ${userId}:`, giftedItems);

              io.to(userId.toString()).emit("treasureBoxItem", {
                message: `You have received bundle a gift!`,
                items: giftedItems,
                lastGiftDetails,
              });
            } else {
              const randomItem =
                items[Math.floor(Math.random() * items.length)];

              io.to(userId.toString()).emit("test123", {
                message: "Test123",
                lastGiftDetails,
              });

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
                const filteredItems = user[itemType].filter(
                  (i) => !i._id.equals(finalItemdata._id),
                );

                // Add the new item
                filteredItems.push(finalItemdata);

                // Replace the entire array with filtered + new item
                await models.Customer.updateOne(
                  { _id: userId },
                  { $set: { [itemType]: filteredItems } },
                );

                // Hit Socket event in room
                ////////////////////////////////////////////////////////
                io.to(userId.toString()).emit("treasureBoxItem", {
                  item: finalItemdata,
                  message: `You have received a ${finalItemdata.name} as a gift!`,
                  lastGiftDetails,
                });
                ////////////////////////////////////////////////////////
              } else if (randomItem.diamondAmount) {
                // If it is diamond gift

                await models.Customer.updateOne(
                  { _id: userId },
                  { $inc: { diamonds: randomItem.diamondAmount } },
                );

                // Hit Socket event in room
                ////////////////////////////////////////////////////////
                io.to(userId.toString()).emit("treasureBoxItem", {
                  message: `You have received ${randomItem.diamondAmount} diamonds as a gift!`,
                  image:
                    "https://usefun-uploads.s3.ap-south-1.amazonaws.com/1000089129-removebg-preview.png",
                  lastGiftDetails,
                });
                ////////////////////////////////////////////////////////
              } else if (randomItem.beansAmount) {
                // If it is bean gift

                await models.Customer.updateOne(
                  { _id: userId },
                  { $inc: { beans: randomItem.beansAmount } },
                );

                // Hit Socket event in room
                ////////////////////////////////////////////////////////
                io.to(userId.toString()).emit("treasureBoxItem", {
                  message: `You have received ${randomItem.beansAmount} beans as a gift!`,
                  image:
                    "https://usefun-uploads.s3.ap-south-1.amazonaws.com/beans.png",
                  lastGiftDetails,
                });
                ////////////////////////////////////////////////////////
              } else if (randomItem.xp) {
                // If it is xp gift

                const user = await models.Customer.findById(userId)
                  .select("xp")
                  .lean();

                await models.Customer.updateOne(
                  { _id: userId },
                  { $set: { xp: Number(user.xp || 0) + randomItem.xp } },
                );

                // Hit Socket event in room
                ////////////////////////////////////////////////////////
                io.to(userId.toString()).emit("treasureBoxItem", {
                  message: `You have received ${randomItem.xp} EXP as a gift!`,
                  image:
                    "https://usefun-uploads.s3.ap-south-1.amazonaws.com/1000089358-removebg-preview.png",
                  lastGiftDetails,
                });
                ////////////////////////////////////////////////////////
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

          // ✅ Update TreasureBox (room stats)
          const room = await models.Room.findById(roomId);
          const totalDiamondsUsed = room.totalDiamondsUsed + totalGiftDiamonds;
          room.diamondsUsedToday += totalGiftDiamonds;
          room.diamondsUsedCurrentSeason += totalGiftDiamonds;
          room.totalDiamondsUsed = totalDiamondsUsed;
          const previousLevel = room.treasureBoxLevel;
          // update treasure box level progress based on diamonds used today
          room.treasureBoxLevelProgress = await getTreasureBoxLevelProgress(
            room.diamondsUsedToday,
          );
          room.treasureBoxLevel = await getTreasureBoxLevel(
            room.diamondsUsedToday,
          );
          // if level up happened, then only update the updatedAt field, otherwise keep it unchanged to preserve the daily reset logic
          if (previousLevel !== room.treasureBoxLevel) {
            room.treasureBoxLevelUpdatedAt = new Date();

            console.log(
              `Treasure Box Level Up! Previous: ${previousLevel}, New: ${room.treasureBoxLevel}. Triggering random shop item gifting...`,
            );

            // only call giftRandomShopItemInRoom when there is a level up
            // only call 1 time on 1 level up, even if multiple gifts are sent that cause multiple level ups, to avoid gifting too many items in case of multiple level ups in short time.
            // Use lastGiftedTreasureBoxLevel to ensure the gift function is called only once per unique level

            console.log(
              "Checking if random shop item gifting is needed...",
              !room.lastGiftedTreasureBoxLevel,
              room.treasureBoxLevel > room.lastGiftedTreasureBoxLevel,
              room.treasureBoxLevel,
              room.lastGiftedTreasureBoxLevel,
            );

            if (
              !room.lastGiftedTreasureBoxLevel ||
              room.treasureBoxLevel > room.lastGiftedTreasureBoxLevel
            ) {
              room.lastGiftedTreasureBoxLevel = room.treasureBoxLevel;
              await giftRandomShopItemInRoom(roomId, {
                senderC,
                receiverC,
                selectedGift,
              });
            }
          }
          await room.save();

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

  const getTreasureBoxLevel = async (totalDiamonds) => {
    // instead of constants.diamondsLevel.L0, L1, etc., we now use TreasureBoxLevelSchema levels from the database. This allows dynamic configuration of levels and thresholds without code changes.

    const levels = await models.TreasureBoxLevel.find({})
      .sort({ level: 1 })
      .lean();

    if (totalDiamonds < levels[0]?.diamondToOpen) {
      return 0;
    } else if (totalDiamonds < levels[1]?.diamondToOpen) {
      return 1;
    } else if (totalDiamonds < levels[2]?.diamondToOpen) {
      return 2;
    } else if (totalDiamonds < levels[3]?.diamondToOpen) {
      return 3;
    } else if (totalDiamonds < levels[4]?.diamondToOpen) {
      return 4;
    } else {
      return 5;
    }
  };

  const getTreasureBoxLevelProgress = async (totalDiamonds) => {
    // This function calculates the progress towards the next treasure box level as a percentage. It uses the same TreasureBoxLevel thresholds from the database to determine the current and next levels.
    // Fetch levels from the database
    const levels = await models.TreasureBoxLevel.find({})
      .sort({ level: 1 })
      .lean();

    let currentLevel = 0;
    let nextLevelThreshold = levels[0]?.diamondToOpen || 1000; // Default to 1000 if not defined

    for (let i = 0; i < levels.length; i++) {
      if (totalDiamonds < levels[i].diamondToOpen) {
        nextLevelThreshold = levels[i].diamondToOpen;
        break;
      }
      currentLevel = levels[i].level;
    }

    const previousLevelThreshold =
      currentLevel === 0 ? 0 : levels[currentLevel - 1].diamondToOpen;

    // Calculate progress towards next level
    const progress =
      ((totalDiamonds - previousLevelThreshold) /
        (nextLevelThreshold - previousLevelThreshold)) *
      100;
    return Math.min(100, Math.max(0, progress)); // Ensure progress is between 0 and 100
  };
};

module.exports = { configure };
