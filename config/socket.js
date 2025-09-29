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
          `leaveRoom event triggered without userId and roomId for socket ${socket.id}`
        );
        console.log(
          `Warning: leaveRoom event triggered without userId and roomId for socket ${socket.id}`
        );
        return;
      }

      logger.info(
        `Received leaveRoom event with data: userId=${userId}, roomId=${roomId}`
      );
      console.log(
        `Received leaveRoom event with data: userId=${userId}, roomId=${roomId}`
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
          }
        );

        await models.Customer.updateOne(
          { _id: userId },
          {
            $set: {
              isLive: false,
              currentJoinedRoomId: null, // <-- Set room reference to null
            },
            $pull: { recentlyJoinedRooms: roomId },
          }
        );

        console.log(
          `Client ${socket.id} has been removed from room ${roomId} (${userId})`
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
          `leaveRoom event triggered without userId and roomId for socket ${socket.id}`
        );
        console.log(
          `Warning: leaveRoom event triggered without userId and roomId for socket ${socket.id}`
        );
        return;
      }

      logger.info(
        `Received leaveRoom event with data: userId=${userId}, roomId=${roomId}`
      );
      console.log(
        `Received leaveRoom event with data: userId=${userId}, roomId=${roomId}`
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
          }
        );

        await models.Customer.findOneAndUpdate(
          { _id: userId },
          {
            $set: { isLive: false },
            $pull: { recentlyJoinedRooms: roomId },
          }
        );

        if (room.ownerId === userId) {
          if (room.lastHostJoinedAt !== null) {
            const currentHostTime = moment().diff(
              moment(room.lastHostJoinedAt),
              "seconds"
            );
            await models.Room.updateOne(
              { _id: roomId },
              {
                $set: {
                  hostingTimeCurrentSession: currentHostTime,
                  lastHostJoinedAt: null,
                },
              }
            );
          }
        }

        console.log(
          `Client ${socket.id} has been removed from room ${roomId} (${userId})`
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

    socket.on("sendGift", async (data) => {
      const { sender, receiver, giftId, count, qtyId } = data;

      console.log("📩 [sendGift] Incoming data:", data);

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
          console.log("➡️ Using roomId:", roomId);

          // ✅ Fetch quantity cashback
          console.log("🔍 Fetching QuantityCashback by ID:", qtyId);
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
          console.log("✅ Found QuantityCashback:", quantityData);

          // ✅ Fetch gift
          console.log("🔍 Fetching Gift by ID:", giftId);
          const selectedGift = await models.Gift.findById(giftId).populate(
            "categoryId"
          );
          if (!selectedGift) {
            console.warn("❌ Gift not found:", giftId);
            io.to(sender).emit("errorMessage", {
              success: false,
              message: "Gift not found",
            });
            return;
          }
          console.log("✅ Found Gift:", selectedGift.name);

          const categoryName =
            selectedGift.categoryId?.name?.toLowerCase() ||
            selectedGift.categoryId?.toLowerCase();
          const totalGiftDiamonds = selectedGift.diamonds * quantity;
          console.log(
            `🎁 Gift category: ${categoryName}, total diamonds required: ${totalGiftDiamonds}`
          );

          // ✅ Fetch customers (sender + receiver)
          console.log("🔍 Fetching sender & receiver...");
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
          console.log(
            "✅ Sender:",
            senderC.name,
            "| Receiver:",
            receiverC.name
          );

          // ✅ Diamond balance check
          console.log("💎 Sender diamonds:", senderC.diamonds);
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
            console.log("🎲 Surprise gift detected, applying special logic...");
            actualReceiverBeans = Math.floor(totalGiftDiamonds / 2);

            const shouldGiveCashback = Math.random() < 0.3;
            console.log(
              `🎲 Cashback chance triggered: ${
                shouldGiveCashback ? "YES" : "NO"
              }`
            );

            if (shouldGiveCashback) {
              const now = new Date();
              const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

              console.log("📊 Aggregating GiftTransactions in last 5 mins...");
              const transactions = await models.GiftTransaction.aggregate([
                {
                  $match: {
                    countryCode: senderC.countryCode,
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

              console.log(
                `💰 Cashback granted: ${senderCashback} (Recent total: ${recentTotal}, Max: ${maxCashback})`
              );
            }
          }

          // ✅ Update sender balance
          console.log("✏️ Updating sender balance...");
          senderC.diamonds += senderCashback - totalGiftDiamonds;
          senderC.usedDiamonds += totalGiftDiamonds;
          senderC.xp = (
            BigInt(senderC.xp) + BigInt(totalGiftDiamonds)
          ).toString();
          senderC.level = getUserLevel(BigInt(senderC.xp));
          await senderC.save();
          console.log("✅ Sender balance updated:", senderC.diamonds);

          // ✅ Update receiver beans
          console.log("✏️ Updating receiver beans...");
          receiverC.beans += actualReceiverBeans;
          await receiverC.save();
          console.log("✅ Receiver beans updated:", receiverC.beans);

          // ✅ Save SendGift + GiftTransaction + History
          console.log("📝 Saving SendGift, GiftTransaction, and History...");
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
          console.log("✅ Transactions saved to DB");

          // ✅ Update TreasureBox (room stats)
          console.log("📦 Updating room treasure box stats...");
          const room = await models.Room.findById(roomId);
          const totalDiamondsUsed = room.totalDiamondsUsed + totalGiftDiamonds;
          room.diamondsUsedToday += totalGiftDiamonds;
          room.diamondsUsedCurrentSeason += totalGiftDiamonds;
          room.totalDiamondsUsed = totalDiamondsUsed;
          room.treasureBoxLevel = getTreasureBoxLevel(room.diamondsUsedToday);
          await room.save();
          console.log("✅ Room updated:", {
            treasureBoxLevel: room.treasureBoxLevel,
            diamondsUsedToday: room.diamondsUsedToday,
          });

          // ✅ Emit sender updated data
          console.log("📡 Emitting updated user data to sender...");
          const userData = await models.Customer.findById(sender);
          io.to(sender).emit("userDataUpdate", userData);

          // ✅ Emit giftSent to all rooms in sender’s country
          console.log("📡 Broadcasting giftSent to all country rooms...");
          const allRooms = await models.Room.find(
            { countryCode: senderC.countryCode },
            { _id: 1 }
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
          console.log("📡 Emitting diamondUpdate to sender...");
          io.to(sender).emit("diamondUpdate", {
            userId: sender,
            totalDiamonds: senderC.diamonds,
            receivedCashbackDiamonds: senderCashback,
          });

          // ✅ Emit bean update
          console.log("📡 Emitting beanUpdate to receiver...");
          io.to(receiver).emit("beanUpdate", {
            userId: receiver,
            totalBeans: receiverC.beans,
            receivedBeans: actualReceiverBeans,
          });

          // ✅ Emit treasure box update
          console.log("📡 Emitting treasureBoxUpdate to room...");
          io.to(roomId).emit("treasureBoxUpdate", {
            diamondsUsedToday: room.diamondsUsedToday,
            treasureBoxLevel: room.treasureBoxLevel,
            totalDiamondsUsed: room.totalDiamondsUsed,
            diamondsUsedCurrentSeason: room.diamondsUsedCurrentSeason,
          });

          // ✅ Emit giftUpdate
          console.log("📡 Emitting giftUpdate to room...");
          io.to(roomId).emit("giftUpdate", {
            receiver,
            giftId,
            count,
            sender,
            points: selectedGift.diamonds,
          });

          console.log("✅ [sendGift] Event completed successfully!");
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

  const getTreasureBoxLevel = (totalDiamonds) => {
    if (totalDiamonds < constants.diamondsLevel.L0) {
      return 0;
    } else if (totalDiamonds < constants.diamondsLevel.L1) {
      return 1;
    } else if (totalDiamonds < constants.diamondsLevel.L2) {
      return 2;
    } else if (totalDiamonds < constants.diamondsLevel.L3) {
      return 3;
    } else if (totalDiamonds < constants.diamondsLevel.L4) {
      return 4;
    } else {
      return 5;
    }
  };
};

module.exports = { configure };
