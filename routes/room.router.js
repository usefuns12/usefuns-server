const express = require("express");
const controller = require('../controllers/room.controller');
const middleware = require('../middlewares');

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
router.route("/add").post(middleware.uploads.single('file'), controller.addRoom);
router.route("/update/:id").put(middleware.uploads.single('file'),controller.updateRoom);
router.route("/blockUser").post(controller.blockUser);
router.route("/activeUser/add").post(controller.addActiveUser);
router.route("/activeUser/addLockedRoom").post(controller.addLockedRoom);
router.route("/activeUser/remove").post(controller.removeActiveUser);
router.route("/group/addActiveUser").post(controller.addGroupActiveUser);
router.route("/group/removeActiveUser").post(controller.removeGroupActiveUser);
router.route("/admin/add").post(controller.addAdmin);
router.route("/admin/remove").post(controller.removeAdmin);

module.exports = router;