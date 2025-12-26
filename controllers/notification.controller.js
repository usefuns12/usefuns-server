const models = require("../models");
const logger = require("../classes").Logger(__filename);

/**
 * ================================
 * GET ALL NOTIFICATIONS
 * ================================
 */
const getNotifications = async (req, res) => {
  try {
    const { customerId } = req.params;

    const notifications = await models.Notification.find({ sentTo: customerId })
      .populate("sentBy", "customerRef name email")
      .populate("sentTo", "customerRef name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * ================================
 * ADD NOTIFICATION
 * ================================
 */
const addNotification = async (req, res) => {
  try {
    const noti = req.body;

    if (!noti.title || !noti.message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    // Handle uploaded image if available
    if (req.body.notificationImage) {
      noti.image = req.body.notificationImage;
    }

    // Parse JSON for data field if provided
    if (typeof noti.data === "string") {
      try {
        noti.data = JSON.parse(noti.data);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid data format, must be JSON object",
        });
      }
    }

    // Create
    const created = await models.Notification.create(noti);

    res.status(200).json({
      success: true,
      message: "Notification created successfully",
      data: created,
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * ================================
 * UPDATE NOTIFICATION
 * ================================
 */
const updateNotification = async (req, res) => {
  const noti = req.body;

  if (!noti?._id) {
    return res.status(400).json({
      success: false,
      message: "Please provide notification id",
    });
  }

  try {
    // Handle image update
    if (req.body.notificationImage) {
      noti.image = req.body.notificationImage;
    }

    // Parse JSON for data field
    if (typeof noti.data === "string") {
      try {
        noti.data = JSON.parse(noti.data);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid data format, must be JSON object",
        });
      }
    }

    await models.Notification.updateOne({ _id: noti._id }, { $set: noti });

    res.status(200).json({
      success: true,
      message: "Notification updated successfully",
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * ================================
 * DELETE NOTIFICATION
 * ================================
 */
const deleteNotification = async (req, res) => {
  const id = req.params.id;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Please provide notification id",
    });
  }

  try {
    const result = await models.Notification.findByIdAndDelete(id);

    if (!result) {
      return res
        .status(400)
        .json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getNotifications,
  addNotification,
  updateNotification,
  deleteNotification,
};
