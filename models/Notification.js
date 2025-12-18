const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    // Image (optional)
    image: {
      type: String,
      default: null,
    },

    // Title of notification
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Message content
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Notification category/type
    notificationType: {
      type: String,
      enum: [
        "info",
        "warning",
        "success",
        "error",
        "system",
        "promotion",
        "update",
        "custom",
        "agency",
      ],
      default: "system",
    },

    // Extra contextual data (roomId, agencyId, hostId, userId etc.)
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Who sent the notification
    sentBy: {
      type: String,
      default: "system",
    },

    // Optional: Who should receive this notification
    sentTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
        default: [],
      },
    ],

    // Whether this is global/system-wide broadcast
    isGlobal: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);
