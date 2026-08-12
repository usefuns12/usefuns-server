const models = require("../models"); // adjust path
const notificationService = require("../utils/notificationService");

const notifyAgencyOwner = async ({
  ownerUserId,
  agency,
  title,
  message,
  action,
}) => {
  if (!ownerUserId) return null;

  const ownerUser = await models.User.findById(ownerUserId)
    .select("customerRef")
    .lean();
  const customerId = ownerUser?.customerRef || null;

  const notification = await models.Notification.create({
    sentTo: customerId ? [customerId] : [],
    notificationType: "agency_owner_action",
    title,
    message,
    data: {
      agencyId: agency?._id ? agency._id.toString() : null,
      ownerUserId: ownerUserId ? ownerUserId.toString() : null,
      action,
    },
    image: agency?.logo || null,
  });

  if (customerId) {
    await notificationService.sendNotificationToCustomer({
      customerId,
      title,
      body: message,
      data: {
        agencyId: agency?._id ? agency._id.toString() : null,
        ownerUserId: ownerUserId ? ownerUserId.toString() : null,
        action,
      },
    });

    if (typeof io !== "undefined") {
      io.to(customerId.toString()).emit("notificationUpdate", notification);
    }
  }

  return notification;
};

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getDateRangeFromQuery = (startDate, endDate) => {
  const now = new Date();

  if (startDate || endDate) {
    const from = startDate ? startOfDay(new Date(startDate)) : startOfDay(now);
    const to = endDate ? endOfDay(new Date(endDate)) : endOfDay(now);
    return { from, to };
  }

  const to = endOfDay(now);
  const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  return { from, to };
};

const getMonthRange = (month) => {
  const now = new Date();

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mm] = month.split("-").map(Number);
    const from = new Date(year, mm - 1, 1, 0, 0, 0, 0);
    const to = new Date(year, mm, 0, 23, 59, 59, 999);
    return { from, to };
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { from, to };
};

// ✅ 1. Create Agency
const createAgency = async (req, res) => {
  try {
    const { agencyId, name, ownerUserId, customerRef, image } = req.body;

    console.log("Req body:", req.body);

    if (!agencyId || !name || !ownerUserId || !customerRef) {
      return res.status(400).json({
        success: false,
        message: "agencyId, name, ownerUserId, and customerRef are required",
      });
    }

    // Check if agencyId already exists
    const existingAgency = await models.Agency.findOne({ agencyId });
    if (existingAgency) {
      return res.status(400).json({
        success: false,
        message: "Agency with this agencyId already exists",
      });
    }

    // Check if owner user exists
    const owner = await models.User.findById(ownerUserId)
      .populate("customerRef")
      .populate("role");
    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: "Owner user not found" });
    }

    // ✅ Extract country from owner’s customerRef
    const country = owner.customerRef?.countryCode;
    if (!country) {
      return res.status(400).json({
        success: false,
        message: "Owner user does not have a valid countryCode in customerRef",
      });
    }

    // ✅ Auto-generate a 4-digit unique numeric code
    let code;
    let isUnique = false;
    while (!isUnique) {
      code = Math.floor(1000 + Math.random() * 9000); // 1000–9999
      const existingCode = await models.Agency.findOne({ code });
      if (!existingCode) isUnique = true;
    }

    let isSubAdmin = false;
    if (owner.role && owner.role.name === "SubAdmin") {
      isSubAdmin = true;
    }

    // Create agency
    const newAgency = await models.Agency.create({
      agencyId,
      code, // auto-generated 4 digit unique
      name,
      ownerUserId,
      customerRef,
      country, // from owner.customerRef.countryCode
      hosts: [],
      stats: { totalHosts: 0, activeHosts: 0, newHosts: 0 },
      logo: image || (req.file ? req.file.location : null),
      status: isSubAdmin ? "inactive" : "active", // if SubAdmin, set inactive for review
    });

    await notifyAgencyOwner({
      ownerUserId,
      agency: newAgency,
      title: "Agency Created",
      message: `Agency "${name}" has been created successfully.`,
      action: "created",
    });

    // Update Customer to link this Agency
    await models.Customer.findByIdAndUpdate(customerRef, {
      agencyId: newAgency._id,
    });

    if (isSubAdmin) {
      // Create a JoinRequest for Admin review
      await models.JoinRequest.create({
        type: "requestForAdminToReviewAgency",
        fromAgencyId: newAgency._id,
        toUserId: owner.parents.length
          ? owner.parents[owner.parents.length - 1] // assuming last parent is Admin
          : null,
        message: `New agency "${name}" created by SubAdmin "${owner.customerRef?.name}" requires your review.`,
      });
    }

    // get new created agency with populated fields
    const populatedAgency = await models.Agency.findById(newAgency._id)
      .populate("ownerUserId", "customerRef role") // show basic owner info
      .populate("hosts")
      .populate("customerRef"); // show hosts linked to agency

    return res.status(201).json({
      success: true,
      message: "Agency created successfully",
      data: populatedAgency,
    });
  } catch (error) {
    console.error("Error creating agency:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ 1. Create Agency
const createAgencyByAuthenticatedUser = async (req, res) => {
  try {
    const ownerUserId = req.body.ownerUserId || req.user._id;

    const { agencyId, name, customerRef } = req.body;

    if (!agencyId || !name || !ownerUserId || !customerRef) {
      return res.status(400).json({
        success: false,
        message: "agencyId, name, ownerUserId, and customerRef are required",
      });
    }

    // Check if agencyId already exists
    const existingAgency = await models.Agency.findOne({ agencyId });
    if (existingAgency) {
      return res.status(400).json({
        success: false,
        message: "Agency with this agencyId already exists",
      });
    }

    // Check if owner user exists
    const owner =
      await models.User.findById(ownerUserId).populate("customerRef");
    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: "Owner user not found" });
    }

    // ✅ Extract country from owner’s customerRef
    const country = owner.customerRef?.countryCode;
    if (!country) {
      return res.status(400).json({
        success: false,
        message: "Owner user does not have a valid countryCode in customerRef",
      });
    }

    // ✅ Auto-generate a 4-digit unique numeric code
    let code;
    let isUnique = false;
    while (!isUnique) {
      code = Math.floor(1000 + Math.random() * 9000); // 1000–9999
      const existingCode = await models.Agency.findOne({ code });
      if (!existingCode) isUnique = true;
    }

    // Create agency
    const newAgency = await models.Agency.create({
      agencyId,
      code, // auto-generated 4 digit unique
      name,
      ownerUserId,
      customerRef,
      country, // from owner.customerRef.countryCode
      hosts: [],
      stats: { totalHosts: 0, activeHosts: 0, newHosts: 0 },
    });

    await notifyAgencyOwner({
      ownerUserId,
      agency: newAgency,
      title: "Agency Assigned",
      message: `Agency "${name}" has been assigned to your profile.`,
      action: "assigned",
    });

    // Update Customer to link this Agency
    await models.Customer.findByIdAndUpdate(customerRef, {
      agencyId: newAgency._id,
    });

    // get new created agency with populated fields
    const populatedAgency = await models.Agency.findById(newAgency._id)
      .populate("ownerUserId", "customerRef role") // show basic owner info
      .populate("hosts")
      .populate("customerRef"); // show hosts linked to agency

    return res.status(201).json({
      success: true,
      message: "Agency created successfully",
      data: populatedAgency,
    });
  } catch (error) {
    console.error("Error creating agency:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Agencies
const getAllAgencies = async (req, res) => {
  try {
    const agencies = await models.Agency.find()
      .populate({
        path: "ownerUserId",
        populate: [
          { path: "customerRef", select: "name deviceToken countryCode" },
          { path: "role", select: "name" },
        ],
      })
      .populate("hosts")
      .populate("customerRef"); // show hosts linked to agency

    return res.status(200).json({
      success: true,
      count: agencies.length,
      data: agencies,
    });
  } catch (error) {
    console.error("Error fetching all agencies:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ 2. Get Agency Details by ID
const getAgencyById = async (req, res) => {
  try {
    const { id } = req.params;

    const agency = await models.Agency.findById(id)
      .populate({
        path: "ownerUserId",
        populate: [
          { path: "customerRef", select: "name deviceToken countryCode" },
          { path: "role", select: "name" },
        ],
      })
      .populate("hosts")
      .populate("customerRef"); // show hosts linked to agency

    if (!agency) {
      return res
        .status(404)
        .json({ success: false, message: "Agency not found" });
    }

    return res.status(200).json({
      success: true,
      data: agency,
    });
  } catch (error) {
    console.error("Error fetching agency by id:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ 3. Get All Agencies by OwnerUserId
const getAgenciesByOwner = async (req, res) => {
  try {
    const { ownerUserId } = req.params;

    if (!ownerUserId) {
      return res
        .status(400)
        .json({ success: false, message: "ownerUserId is required" });
    }

    // get all child users of the ownerUserId
    const ownerUser = await models.User.findById(ownerUserId);

    const childUserIds = [];
    if (ownerUser && ownerUser.children && ownerUser.children.length) {
      ownerUser.children.forEach((child) => {
        childUserIds.push(child._id);
      });
    }

    const allOwnerIds = [ownerUserId, ...childUserIds];

    const agencies = await models.Agency.find({
      ownerUserId: { $in: allOwnerIds },
    })
      .populate("hosts")
      .populate({
        path: "ownerUserId",
        populate: [
          { path: "customerRef", select: "name deviceToken countryCode" },
          { path: "role", select: "name" },
        ],
      })
      .populate("customerRef");

    return res.status(200).json({
      success: true,
      count: agencies.length,
      data: agencies,
    });
  } catch (error) {
    console.error("Error fetching agencies by owner:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ 3. Get All Agencies by OwnerUserId
const getAgenciesByOwnerIdFromMiddlware = async (req, res) => {
  try {
    const ownerUserId = req.user._id;

    if (!ownerUserId) {
      return res
        .status(400)
        .json({ success: false, message: "ownerUserId is required" });
    }

    // get all child users of the ownerUserId
    const ownerUser = await models.User.findById(ownerUserId);

    const childUserIds = [];
    if (ownerUser && ownerUser.children && ownerUser.children.length) {
      ownerUser.children.forEach((child) => {
        childUserIds.push(child._id);
      });
    }

    const allOwnerIds = [ownerUserId, ...childUserIds];

    const agencies = await models.Agency.find({
      ownerUserId: { $in: allOwnerIds },
    })
      .populate("hosts")
      .populate({
        path: "ownerUserId",
        populate: [
          { path: "customerRef", select: "name deviceToken countryCode" },
          { path: "role", select: "name" },
        ],
      })
      .populate("customerRef");

    return res.status(200).json({
      success: true,
      count: agencies.length,
      data: agencies,
    });
  } catch (error) {
    console.error("Error fetching agencies by owner:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Invite a Host to an Agency
 * -------------------------------
 * Creates a join request of type "joinAgency"
 */
const inviteHostToAgency = async (req, res) => {
  try {
    const { fromAgencyId, toHostId, roomId, message } = req.body;

    if (!fromAgencyId || !toHostId) {
      return res.status(400).json({
        success: false,
        message: "fromAgencyId and toHostId are required",
      });
    }

    // Validate agency
    const agency = await models.Agency.findById(fromAgencyId);
    if (!agency) {
      return res
        .status(404)
        .json({ success: false, message: "Agency not found" });
    }

    // Validate host
    const host = await models.Host.findById(toHostId);
    if (!host) {
      return res
        .status(404)
        .json({ success: false, message: "Host not found" });
    }

    // Check for existing pending invite
    const existing = await models.JoinRequest.findOne({
      type: "joinAgency",
      fromAgencyId,
      toHostId,
      status: "pending",
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Pending invitation already exists for this host",
      });
    }

    const invite = await models.JoinRequest.create({
      type: "joinAgency",
      fromAgencyId,
      toHostId,
      roomId: roomId || null,
      message,
    });

    res.status(201).json({
      success: true,
      message: "Host invited to agency successfully",
      data: invite,
    });
  } catch (error) {
    console.error("Error inviting host:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Agency
const updateAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingAgency = await models.Agency.findById(id).lean();

    const agency = await models.Agency.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!agency) {
      return res
        .status(404)
        .json({ success: false, message: "Agency not found" });
    }

    if (
      updates.ownerUserId &&
      String(updates.ownerUserId) !== String(existingAgency?.ownerUserId || "")
    ) {
      await notifyAgencyOwner({
        ownerUserId: updates.ownerUserId,
        agency,
        title: "Agency Assigned",
        message: `Agency "${agency.name}" has been assigned to your profile.`,
        action: "assigned",
      });
    }

    return res.status(200).json({
      success: true,
      data: agency,
    });
  } catch (error) {
    console.error("Error updating agency:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Agency
const deleteAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const agency = await models.Agency.findByIdAndDelete(id);
    if (!agency) {
      return res
        .status(404)
        .json({ success: false, message: "Agency not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Agency deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting agency:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAgencyReportList = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { startDate, endDate } = req.query;

    const agency = await models.Agency.findById(agencyId).lean();
    if (!agency) {
      return res
        .status(404)
        .json({ success: false, message: "Agency not found" });
    }

    const { from, to } = getDateRangeFromQuery(startDate, endDate);

    const hosts = await models.Host.find({ agencyId })
      .select("_id hostId customerRef")
      .populate("customerRef", "name profileImage userId")
      .lean();

    const hostIds = hosts.map((host) => host._id);

    if (!hostIds.length) {
      return res.status(200).json({
        success: true,
        data: {
          dateRange: { from, to },
          summary: {
            sumPaidHostsRoomGiftingBeans: 0,
            topHostQty: 0,
            agencyPercentage: 0,
            topHostPercentage: 0,
            commissionBeans: 0,
          },
          list: [],
        },
      });
    }

    const [hostStatRows, hostSalaryRows, policy, commissionCycle] =
      await Promise.all([
        models.HostStat.aggregate([
          {
            $match: {
              hostId: { $in: hostIds },
              date: { $gte: from, $lte: to },
            },
          },
          {
            $group: {
              _id: "$hostId",
              sumHostingHours: { $sum: { $ifNull: ["$hostTimeHours", 0] } },
              sumRoomGifting: { $sum: { $ifNull: ["$gifts", 0] } },
              sumVisitors: { $sum: { $ifNull: ["$visitors", 0] } },
            },
          },
        ]),
        models.HostSalaryCycle.aggregate([
          {
            $match: {
              hostId: { $in: hostIds },
              cycleStart: { $lte: to },
              cycleEnd: { $gte: from },
            },
          },
          {
            $group: {
              _id: "$hostId",
              totalSalary: { $sum: { $ifNull: ["$salaryUcoins", 0] } },
              totalValidDiamonds: { $sum: { $ifNull: ["$validDiamonds", 0] } },
            },
          },
        ]),
        models.Policy.findOne({ type: "hostSalary" })
          .select("hostSalary.diamondTarget")
          .lean(),
        models.AgencyCommissionCycle.findOne({
          agencyId,
          cycleStart: { $lte: to },
          cycleEnd: { $gte: from },
        })
          .sort({ cycleEnd: -1, createdAt: -1 })
          .lean(),
      ]);

    const statMap = new Map(hostStatRows.map((row) => [String(row._id), row]));
    const salaryMap = new Map(
      hostSalaryRows.map((row) => [String(row._id), row]),
    );

    const list = hosts
      .map((host) => {
        const stat = statMap.get(String(host._id)) || {};
        const salary = salaryMap.get(String(host._id)) || {};

        return {
          hostRef: host._id,
          hostId: host.hostId,
          name: host.customerRef?.name || null,
          profileImage: host.customerRef?.profileImage || null,
          sumHostingHours: safeNumber(stat.sumHostingHours),
          sumRoomGifting: safeNumber(stat.sumRoomGifting),
          totalSalary: safeNumber(salary.totalSalary),
          visitors: safeNumber(stat.sumVisitors),
          totalValidDiamonds: safeNumber(salary.totalValidDiamonds),
        };
      })
      .sort((a, b) => b.sumRoomGifting - a.sumRoomGifting);

    const sumPaidHostsRoomGiftingBeans = list.reduce(
      (acc, row) => acc + safeNumber(row.sumRoomGifting),
      0,
    );
    const paidHostsCount = list.filter((row) => row.totalSalary > 0).length;
    const diamondTarget = safeNumber(policy?.hostSalary?.diamondTarget);
    const topHostQty = diamondTarget
      ? list.filter((row) => row.totalValidDiamonds >= diamondTarget).length
      : 0;
    const topHostPercentage = paidHostsCount
      ? Number(((topHostQty / paidHostsCount) * 100).toFixed(2))
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        dateRange: { from, to },
        summary: {
          sumPaidHostsRoomGiftingBeans,
          topHostQty,
          agencyPercentage: safeNumber(commissionCycle?.commissionPercentage),
          topHostPercentage,
          commissionBeans: safeNumber(commissionCycle?.commissionUcoins),
        },
        list,
      },
    });
  } catch (error) {
    console.error("Error fetching agency report list:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getPossibleLostHostsList = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { limit = 100, salaryCap = 200000 } = req.query;

    const agency = await models.Agency.findById(agencyId).lean();
    if (!agency) {
      return res
        .status(404)
        .json({ success: false, message: "Agency not found" });
    }

    const hosts = await models.Host.find({ agencyId })
      .select("_id hostId customerRef")
      .populate("customerRef", "name profileImage userId")
      .lean();

    const hostIds = hosts.map((host) => host._id);
    if (!hostIds.length) {
      return res.status(200).json({
        success: true,
        data: {
          salaryWindowWeeks: 20,
          cap: Number(salaryCap),
          totalPossibleLostHosts: 0,
          list: [],
        },
      });
    }

    const twentyWeeksAgo = new Date();
    twentyWeeksAgo.setDate(twentyWeeksAgo.getDate() - 20 * 7);

    const salaryRows = await models.HostSalaryCycle.aggregate([
      {
        $match: {
          hostId: { $in: hostIds },
          cycleStart: { $gte: twentyWeeksAgo },
        },
      },
      {
        $group: {
          _id: "$hostId",
          salaryInLast20Weeks: { $sum: { $ifNull: ["$salaryUcoins", 0] } },
        },
      },
    ]);

    const salaryMap = new Map(
      salaryRows.map((row) => [
        String(row._id),
        safeNumber(row.salaryInLast20Weeks),
      ]),
    );

    const capValue = Number(salaryCap);
    const list = hosts
      .map((host) => ({
        hostRef: host._id,
        hostId: host.hostId,
        name: host.customerRef?.name || null,
        profileImage: host.customerRef?.profileImage || null,
        salaryInLast20Weeks: salaryMap.get(String(host._id)) || 0,
      }))
      .filter((row) => row.salaryInLast20Weeks <= capValue)
      .sort((a, b) => b.salaryInLast20Weeks - a.salaryInLast20Weeks)
      .slice(0, Number(limit));

    return res.status(200).json({
      success: true,
      data: {
        salaryWindowWeeks: 20,
        cap: capValue,
        totalPossibleLostHosts: list.length,
        list,
      },
    });
  } catch (error) {
    console.error("Error fetching possible lost hosts:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getSubAgencyDataList = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { month, startDate, endDate } = req.query;

    const agency = await models.Agency.findById(agencyId).lean();
    if (!agency) {
      return res
        .status(404)
        .json({ success: false, message: "Agency not found" });
    }

    const ownerUser = await models.User.findById(agency.ownerUserId)
      .select("children")
      .lean();

    const childIds = Array.isArray(ownerUser?.children)
      ? ownerUser.children
      : [];

    if (!childIds.length) {
      return res.status(200).json({
        success: true,
        data: {
          totalGifts: 0,
          list: [],
        },
      });
    }

    const subAgencies = await models.Agency.find({
      ownerUserId: { $in: childIds },
    })
      .select("_id agencyId name")
      .lean();

    const dateRange =
      startDate || endDate
        ? getDateRangeFromQuery(startDate, endDate)
        : getMonthRange(month);

    const rows = await Promise.all(
      subAgencies.map(async (subAgency) => {
        const hosts = await models.Host.find({ agencyId: subAgency._id })
          .select("_id")
          .lean();
        const hostIds = hosts.map((host) => host._id);

        if (!hostIds.length) {
          return {
            agencyRef: subAgency._id,
            agencyId: subAgency.agencyId,
            agencyName: subAgency.name,
            totalGifts: 0,
          };
        }

        const giftAggregation = await models.HostStat.aggregate([
          {
            $match: {
              hostId: { $in: hostIds },
              date: { $gte: dateRange.from, $lte: dateRange.to },
            },
          },
          {
            $group: {
              _id: null,
              totalGifts: { $sum: { $ifNull: ["$gifts", 0] } },
            },
          },
        ]);

        return {
          agencyRef: subAgency._id,
          agencyId: subAgency.agencyId,
          agencyName: subAgency.name,
          totalGifts: safeNumber(giftAggregation[0]?.totalGifts),
        };
      }),
    );

    const list = rows.sort((a, b) => b.totalGifts - a.totalGifts);
    const totalGifts = list.reduce(
      (acc, item) => acc + safeNumber(item.totalGifts),
      0,
    );

    return res.status(200).json({
      success: true,
      data: {
        dateRange,
        totalGifts,
        list,
      },
    });
  } catch (error) {
    console.error("Error fetching sub-agency data list:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createAgency,
  getAllAgencies,
  getAgencyById,
  getAgenciesByOwner,
  updateAgency,
  deleteAgency,
  deleteAgency,
  inviteHostToAgency,
  getAgenciesByOwnerIdFromMiddlware,
  createAgencyByAuthenticatedUser,
  getAgencyReportList,
  getPossibleLostHostsList,
  getSubAgencyDataList,
};
