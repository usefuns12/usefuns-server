const express = require("express");
const controller = require('../controllers/payment.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/getPaymentUrl").post(controller.getPaymentUrl);
router.route("/getPaymentStatus/:txnId").get(controller.getPaymentStatus);
router.route("/getPaymentCode/:txnId").get(controller.getPaymentCode);

module.exports = router;