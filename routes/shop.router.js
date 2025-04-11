const express = require("express");
const controller = require('../controllers/shop.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/getItems").get(controller.getItems);
router.route("/addItem").post(middleware.uploads.fields([{name: 'resource'}, {name: 'thumbnail'}]), controller.addItem);
router.route("/updateItem").put(middleware.uploads.fields([{name: 'resource'}, {name: 'thumbnail'}]), controller.updateItem);
router.route("/deleteItem/:id").delete(controller.deleteItem);

module.exports = router;