const express = require("express");
const controller = require("../controllers/treasurebox.controller");
const middlewares = require("../middlewares");

const router = express.Router();

router.get("/levels", controller.getAllLevels);
router.post(
  "/level",
  middlewares.uploads.single("file"),
  controller.createLevel,
);
router.put(
  "/level",
  middlewares.uploads.single("file"),
  controller.updateLevel,
);

module.exports = router;
