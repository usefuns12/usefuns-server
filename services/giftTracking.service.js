const HostStat = require("../models/HostStat");
const GiftTransaction = require("../models/GiftTransaction");
const Host = require("../models/Host");
const Customer = require("../models/Customer");

/**
 * Track gift sending and update valid diamonds for salary calculation
 * @param {Object} giftData - Gift transaction data
 * @param {ObjectId} giftData.senderId - Sender's ID
 * @param {ObjectId} giftData.receiverId - Receiver customer's ID
 * @param {ObjectId} giftData.giftId - Gift's ID
 * @param {Number} giftData.totalDiamonds - Total diamonds of gift
 * @param {String} giftData.senderCountryCode - Sender's country code
 * @param {String} giftData.receiverCountryCode - Receiver's country code
 */
async function trackGiftForSalary(giftData) {
  try {
    const {
      senderId,
      receiverId,
      giftId,
      totalDiamonds,
      senderCountryCode,
      receiverCountryCode,
    } = giftData;

    // Host table links to customerRef, while gift receiver stores customer ID.
    const host = await Host.findOne({ customerRef: receiverId })
      .select("_id")
      .lean();

    // Fallback lookup so same-country rule stays enforced even if caller misses receiverCountryCode.
    let finalReceiverCountryCode = receiverCountryCode;
    if (!finalReceiverCountryCode && receiverId) {
      const receiverCustomer = await Customer.findById(receiverId)
        .select("countryCode")
        .lean();
      finalReceiverCountryCode = receiverCustomer?.countryCode;
    }

    // A gift counts for salary only when sender and receiver belong to same country.
    const isValidForSalary =
      Boolean(host) &&
      Boolean(senderCountryCode) &&
      Boolean(finalReceiverCountryCode) &&
      senderCountryCode === finalReceiverCountryCode;

    // Create gift transaction with validity flag
    const giftTransaction = await GiftTransaction.create({
      sender: senderId,
      receiver: receiverId,
      gift: giftId,
      totalDiamonds,
      countryCode: senderCountryCode,
      isValidForSalary,
      giftTime: new Date(),
    });

    // Only count valid gifts for salary
    if (isValidForSalary) {
      // Update HostStat
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await HostStat.findOneAndUpdate(
        { hostId: host._id, date: today },
        {
          $inc: { gifts: totalDiamonds },
          $setOnInsert: {
            hostId: host._id,
            date: today,
            hostTimeHours: 0,
          },
        },
        { upsert: true },
      );

      console.log(
        `✅ Valid gift tracked: ${totalDiamonds} diamonds for host ${host._id}`,
      );
    } else {
      console.log(
        `⚠️ Gift not salary-eligible (non-host receiver or country mismatch)`,
      );
    }

    return giftTransaction;
  } catch (error) {
    console.error("Error tracking gift for salary:", error);
    throw error;
  }
}

/**
 * Get aggregated valid diamonds for a host in a date range
 * @param {ObjectId} hostId - The host's ID
 * @param {Date} startDate - Start date of period
 * @param {Date} endDate - End date of period
 */
async function getValidDiamonds(hostId, startDate, endDate) {
  try {
    const host = await Host.findById(hostId).select("customerRef").lean();
    if (!host || !host.customerRef) {
      return 0;
    }

    const result = await GiftTransaction.aggregate([
      {
        $match: {
          receiver: host.customerRef,
          isValidForSalary: true,
          giftTime: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalValidDiamonds: { $sum: "$totalDiamonds" },
        },
      },
    ]);

    return result.length > 0 ? result[0].totalValidDiamonds : 0;
  } catch (error) {
    console.error("Error getting valid diamonds:", error);
    return 0;
  }
}

module.exports = {
  trackGiftForSalary,
  getValidDiamonds,
};
