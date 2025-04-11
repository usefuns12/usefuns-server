const express = require("express");
const controller = require('../controllers/carousel.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/getCarousels").get(controller.getCarousels);
router.route("/add").post(middleware.uploads.single('file'), controller.addCarousel);
router.route("/update").put(middleware.uploads.single('file'), controller.updateCarousel);
router.route("/delete/:id").delete(controller.deleteCarousel);

module.exports = router;