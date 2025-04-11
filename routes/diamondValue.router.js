const express = require("express");
const controller = require('../controllers/diamondValue.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/getDiamonds").get(controller.getDiamondValues);
router.route("/addDiamond").post(controller.addDiamondValue);
router.route("/updateDiamond").put(controller.updateDiamondValue);
router.route("/deleteDiamond/:id").delete(controller.deleteDiamondValue);

module.exports = router;