const express = require("express");
const controller = require("../controllers/room.controller");
const middleware = require("../middlewares");

const router = express.Router();

router.route("/getRooms").get(controller.getRooms);
router.route("/getAll").get(controller.getRoomsPagination);
router.route("/search/:roomId").get(controller.searchRoom);
router.route("/getLatest/:countryCode").get(controller.getLatestRooms);
router.route("/getPopular/:countryCode").get(controller.getPopularRooms);
router.route("/getRecentlyJoined/:id").get(controller.getRecentlyJoined);
router.route("/getById/:id").get(controller.getRoomById);
router.route("/getByUserId/:id").get(controller.getRoomByUserId);
router.route("/getByGroupMember/:id").get(controller.getRoomByGroupMembers);
router.route("/getRoomContribution").post(controller.getRoomContribution);

router
  .route("/add")
  .post(middleware.uploads.single("file"), controller.addRoom);

router
  .route("/update/:id")
  .put(middleware.uploads.single("file"), controller.updateRoom);

// User Blocking/Unblocking
router.route("/blockUser").post(controller.blockUser);
router.route("/getBlockedUsers/:roomId").get(controller.getBlockedUsers);
router.route("/unblockUser").post(controller.unblockUser);

// Active User Management
router.route("/activeUser/add").post(controller.addActiveUser);
router.route("/activeUser/addLockedRoom").post(controller.addLockedRoom);
router.route("/activeUser/remove").post(controller.removeActiveUser);

// Group Membership
router.route("/group/addActiveUser").post(controller.addGroupActiveUser);
router.route("/group/removeActiveUser").post(controller.removeGroupActiveUser);

// Admin Management
router.route("/admin/add").post(controller.addAdmin);
router.route("/admin/remove").post(controller.removeAdmin);

//
// ===== NEW FEATURES (Kick, Mute, History) =====
//

// 🚫 Kick a user from a room for 3 hours
router.route("/kickUser").post(controller.kickUser);

// 📜 Get kick history in the last 24 hours
router.route("/kickHistory/:roomId").get(controller.getKickHistory);

// 🧾 Get users who joined a room in last 24 hours
router.route("/joinedHistory/:roomId").get(controller.getRoomJoinedUsers);

// 🔇 Mute a user permanently in a room
router.route("/muteUser").post(controller.muteUser);

// 🔊 Unmute a user from a room
router.route("/unmuteUser").post(controller.unmuteUser);

// 🎁 Send a gift to a user in a room
router.post("/send-gift", controller.sendGift);

// 🚫 Ban a user from chat in a room
router.post("/ban-chat-user", controller.banChatUser);

// 🚫 Unban a user from chat in a room
router.post("/unban-chat-user", controller.unbanChatUser);

// Seat Locking Features
router.post("/lock-unlock-seat", controller.updateSeatLocks);

module.exports = router;
