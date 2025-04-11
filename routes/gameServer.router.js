const express = require("express");
const controller = require('../controllers/gameServer.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/get_sstoken").post(controller.get_ssToken);
router.route("/get_user_info").post(controller.getUserInfo);
router.route("/change_balance").post(controller.changeBalance);

module.exports = router;