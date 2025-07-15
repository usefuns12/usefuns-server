const express = require("express");
const router = express.Router();
const controller = require("../controllers/quantityCashback.controller");

router.get("/getQuantities", controller.getQuantities);
router.post("/addQuantity", controller.addQuantity);
router.put("/updateQuantity", controller.updateQuantity);
router.delete("/deleteQuantity/:id", controller.deleteQuantity);

module.exports = router;
