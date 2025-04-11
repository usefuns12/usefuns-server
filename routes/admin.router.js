const express = require("express");
const controller = require('../controllers/admin.controller');
const userController = require('../controllers/customer.controller');
const middleware = require('../middlewares');

const router = express.Router();

router.route("/masterLogin").post(controller.masterLogin);
router.route("/getOfficialUsers").get(controller.getOfficialUsers);
router.route("/addOfficialUser").post(controller.addOfficialUser);
router.route("/updateOfficialUser").put(controller.updateOfficialUser);
router.route("/deleteOfficialUser").delete(controller.deleteOfficialUser);
router.route("/user/update/:id").put(middleware.auth.authAdmin, middleware.uploads.single('file'), userController.updateCustomer);

module.exports = router;