const express = require("express");
const controller = require('../controllers/gift.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/getCategories").get(controller.getCategories);
router.route("/addCategory").post(controller.addCategory);
router.route("/updateCategory").put(controller.updateCategory);
router.route("/deleteCategory/:id").delete(controller.deleteCategory);
router.route("/getGifts").get(controller.getGifts);
router.route("/addGift").post(middleware.uploads.fields([{name: 'resource'}, {name: 'thumbnail'}]), controller.addGift);
router.route("/updateGift").put(middleware.uploads.fields([{name: 'resource'}, {name: 'thumbnail'}]), controller.updateGift);
router.route("/deleteGift/:id").delete(controller.deleteGift);

module.exports = router;