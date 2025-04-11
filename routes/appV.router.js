const express = require("express");
const controller = require('../controllers/appV.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/version/get").get(controller.getAppVersion);
router.route("/version/add").post(controller.addAppVersion);
router.route("/version/update").put(controller.updateAppVersion);
router.route("/version/delete/:id").delete(controller.deleteAppVersion);

module.exports = router;