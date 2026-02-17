const express = require("express");
const controller = require("../controllers/treasurebox.controller");

const router = express.Router();

router.get("/levels", controller.getAllLevels);
router.post("/level", controller.createLevel);
router.put("/level", controller.updateLevel);

module.exports = router;
