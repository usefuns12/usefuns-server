const admin = require("../config/firebase");
const models = require("../models");
const Customer = models.Customer;

/**
 * Send push notification to a customer
 * @param {Object} params
 * @param {String} params.customerId - MongoDB customer _id
 * @param {String} params.title - Notification title
 * @param {String} params.body - Notification body
 * @param {Object} params.data - Optional custom payload
 */
const sendNotificationToCustomer = async ({
  customerId,
  title,
  body,
  data = {},
}) => {
  // 1. Fetch customer
  const customer = await Customer.findById(customerId).select("deviceToken");

  if (!customer) {
    throw new Error("Customer not found");
  }

  if (!customer.deviceToken) {
    throw new Error("Device token not found for this user");
  }

  // 2. Create notification payload
  const message = {
    token: customer.deviceToken,
    notification: {
      title,
      body,
    },
    data: {
      ...Object.entries(data).reduce((acc, [key, value]) => {
        acc[key] = String(value); // FCM requires string values
        return acc;
      }, {}),
    },
    android: {
      priority: "high",
      notification: {
        sound: "default",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  };

  // 3. Send notification
  const response = await admin.messaging().send(message);

  return {
    success: true,
    firebaseResponse: response,
  };
};

module.exports = {
  sendNotificationToCustomer,
};
