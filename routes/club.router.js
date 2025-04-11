const express = require("express");
const controller = require('../controllers/club.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/getAll").get(controller.getClubs);
router.route("/add").post(controller.addClub);

module.exports = router;