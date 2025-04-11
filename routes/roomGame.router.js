const express = require("express");
const controller = require('../controllers/roomGame.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/getAll").get(controller.getRoomGames);
router.route("/add").post(controller.addRoomGame);
router.route("/update").put(controller.updateRoomGame);
router.route("/delete/:id").delete(controller.deleteRoomGame);

module.exports = router;