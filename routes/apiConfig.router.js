const express = require("express");
const controller = require('../controllers/apiConfig.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/getApiKeys").get(controller.getApiKeys);
router.route("/add").post(controller.addApiKey);
router.route("/update").put(controller.updateApiKey);
router.route("/delete/:id").delete(controller.deleteApiKey);

module.exports = router;