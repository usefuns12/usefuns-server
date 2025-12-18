const express = require("express");
const controller = require("../controllers/notification.controller");
const middleware = require("../middlewares");

const router = express.Router();

/**
 * ================================
 * SYSTEM NOTIFICATIONS ROUTES
 * ================================
 */

// 👉 Get all notifications
router.route("/getAll").get(controller.getNotifications);

// 👉 Create notification (with image upload)
router.route("/add").post(
  middleware.uploads.single("file"), // if an image is uploaded
  controller.addNotification
);

// 👉 Update existing notification
router.route("/update/:id?").put(
  middleware.uploads.single("file"), // optional new image
  controller.updateNotification
);

// 👉 Delete notification
router.route("/delete/:id").delete(controller.deleteNotification);

module.exports = router;
