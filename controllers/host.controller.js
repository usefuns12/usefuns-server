const bcrypt = require("bcryptjs");
const models = require("../models");
const mongoose = require("mongoose");
const notificationService = require("../utils/notificationService");

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.toString === "function") return value.toString();
  return String(value);
};

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const pad2 = (value) => String(value).padStart(2, "0");

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const startOfWeek = (date) => {
  const result = startOfDay(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
};

const endOfWeek = (date) => {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return endOfDay(result);
};

const startOfMonth = (date) => {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
};

const endOfMonth = (date) => {
  const result = startOfMonth(date);
  result.setMonth(result.getMonth() + 1);
  result.setDate(0);
  return endOfDay(result);
};

const getMonthLabel = (date) =>
  new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(date));

const getDayLabel = (date) => {
  const d = new Date(date);
  return `${pad2(d.getDate())} ${getMonthLabel(d)}`;
};

const getWeekLabel = (date) => {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${pad2(start.getMonth() + 1)}.${pad2(start.getDate())}-${pad2(
    end.getMonth() + 1,
  )}.${pad2(end.getDate())}`;
};

const getMonthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

const getDayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const getWeekKey = (date) => startOfWeek(date).toISOString().slice(0, 10);

const resolveHostDocument = async (hostId) => {
  if (!hostId) return null;

  if (mongoose.isValidObjectId(hostId)) {
    return models.Host.findById(hostId)
      .populate(
        "customerRef",
        "name userId profileImage countryCode currentJoinedRoomId onSeat diamonds beans",
      )
      .populate("agencyId")
      .lean();
  }

  return models.Host.findOne({ hostId })
    .populate(
      "customerRef",
      "name userId profileImage countryCode currentJoinedRoomId onSeat diamonds beans",
    )
    .populate("agencyId")
    .lean();
};

const getAgencyOwnerScope = async (ownerUserId) => {
  const ownerUser = await models.User.findById(ownerUserId)
    .select("children")
    .lean();

  const childUserIds = Array.isArray(ownerUser?.children)
    ? ownerUser.children
    : [];

  const ownerScopeIds = [ownerUserId, ...childUserIds]
    .filter(Boolean)
    .map(toIdString);

  const agencies = await models.Agency.find({
    ownerUserId: { $in: ownerScopeIds },
  })
    .select("_id agencyId name ownerUserId status logo country stats hosts")
    .lean();

  return {
    ownerScopeIds,
    agencyIds: agencies.map((agency) => toIdString(agency._id)),
    agencies,
  };
};

const getAgencyOwnerHostScope = async (ownerUserId, hostId) => {
  const [ownerScope, host] = await Promise.all([
    getAgencyOwnerScope(ownerUserId),
    resolveHostDocument(hostId),
  ]);

  if (!host) {
    return { ownerScope, host: null, isAllowed: false };
  }

  const hostAgencyId = toIdString(host.agencyId?._id || host.agencyId);
  const isAllowed = hostAgencyId
    ? ownerScope.agencyIds.includes(hostAgencyId)
    : false;

  return {
    ownerScope,
    host,
    isAllowed,
  };
};

const getHostStatDateRange = (period, startDate, endDate) => {
  const now = new Date();
  const normalizedStartDate = startDate ? new Date(startDate) : null;
  const normalizedEndDate = endDate ? new Date(endDate) : null;

  if (normalizedStartDate || normalizedEndDate) {
    return {
      from: normalizedStartDate
        ? startOfDay(normalizedStartDate)
        : startOfDay(now),
      to: normalizedEndDate ? endOfDay(normalizedEndDate) : endOfDay(now),
    };
  }

  if (period === "weekly") {
    return {
      from: startOfWeek(now),
      to: endOfWeek(now),
    };
  }

  if (period === "monthly") {
    return {
      from: startOfMonth(now),
      to: endOfMonth(now),
    };
  }

  return {
    from: startOfMonth(now),
    to: endOfDay(now),
  };
};

const groupHostStats = (stats, period) => {
  const grouped = new Map();

  stats.forEach((item) => {
    const date = item.date || item.createdAt || new Date();
    const key =
      period === "weekly"
        ? getWeekKey(date)
        : period === "monthly"
          ? getMonthKey(date)
          : getDayKey(date);

    const label =
      period === "weekly"
        ? getWeekLabel(date)
        : period === "monthly"
          ? getMonthLabel(date)
          : getDayLabel(date);

    const current = grouped.get(key) || {
      key,
      label,
      visitors: 0,
      selfHostingHours: 0,
      selfHostingMinutes: 0,
      roomGifts: 0,
    };

    current.visitors += safeNumber(item.visitors);
    current.selfHostingHours += safeNumber(item.hostTimeHours);
    current.roomGifts += safeNumber(item.gifts);
    current.selfHostingMinutes = Math.round(current.selfHostingHours * 60);

    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
};

const buildHostDashboardSummary = async (hostId) => {
  const host = await resolveHostDocument(hostId);

  if (!host) {
    return null;
  }

  const [wallet, policy, latestCycle, currentRoom] = await Promise.all([
    models.Wallet.findOne({
      $or: [
        { userRef: host.customerRef?._id || host.customerRef },
        { userId: host.customerRef?.userId },
      ],
    })
      .select(
        "diamonds beans ucoins lockedUcoins withdrawableUcoins fiatBalance status lastTopUpAt lastWithdrawAt",
      )
      .lean(),
    models.Policy.findOne({ type: "hostSalary" }).lean(),
    models.HostSalaryCycle.findOne({ hostId: host._id })
      .sort({ cycleEnd: -1, createdAt: -1 })
      .lean(),
    host.customerRef?.currentJoinedRoomId
      ? models.Room.findById(host.customerRef.currentJoinedRoomId)
          .select(
            "roomId roomType name announcement roomImage noOfSeats activeUsers totalGifts visitorsCount selfHostingCount hostingTimeCurrentSession hostingTimeLastSession countryCode agencyId hostId isActive",
          )
          .populate("agencyId")
          .lean()
      : Promise.resolve(null),
  ]);

  const bonusTarget = safeNumber(policy?.hostSalary?.diamondTarget);
  const bonusProgress = safeNumber(
    latestCycle?.validDiamonds ?? latestCycle?.totalDiamonds,
  );

  return {
    host: {
      _id: host._id,
      hostId: host.hostId,
      joinDate: host.joinDate,
      status: host.status,
      customerRef: host.customerRef,
      agencyId: host.agencyId,
      totalHostTimeHours: safeNumber(host.totalHostTimeHours),
      giftsReceivedTotal: safeNumber(host.giftsReceivedTotal),
    },
    wallet: wallet
      ? {
          diamonds: safeNumber(wallet.diamonds),
          beans: safeNumber(wallet.beans),
          ucoins: safeNumber(wallet.ucoins),
          lockedUcoins: safeNumber(wallet.lockedUcoins),
          withdrawableUcoins: safeNumber(wallet.withdrawableUcoins),
          fiatBalance: safeNumber(wallet.fiatBalance),
          status: wallet.status,
          lastTopUpAt: wallet.lastTopUpAt,
          lastWithdrawAt: wallet.lastWithdrawAt,
        }
      : null,
    currentRoom: currentRoom
      ? {
          ...currentRoom,
          hostingTimeCurrentSessionMinutes: Math.round(
            safeNumber(currentRoom.hostingTimeCurrentSession) / 60,
          ),
          hostingTimeLastSessionMinutes: Math.round(
            safeNumber(currentRoom.hostingTimeLastSession) / 60,
          ),
        }
      : null,
    bonus: {
      currentBonus: safeNumber(latestCycle?.salaryUcoins),
      currentCycleStatus: latestCycle?.status || null,
      currentCycleId: latestCycle?._id || null,
      bonusProgress,
      bonusTarget,
      bonusRemaining: Math.max(bonusTarget - bonusProgress, 0),
      rewardEnabled: Boolean(policy?.hostSalary?.reward?.enabled),
      rewardGranted: Boolean(latestCycle?.rewardGranted),
    },
    policy: policy
      ? {
          version: policy.version || 1,
          diamondTarget: bonusTarget,
          hourSlabs: policy.hostSalary?.hourSlabs || [],
          reward: policy.hostSalary?.reward || null,
        }
      : null,
  };
};

const buildHostDashboardStats = async ({
  hostId,
  period,
  startDate,
  endDate,
}) => {
  const host = await resolveHostDocument(hostId);

  if (!host) {
    return null;
  }

  const { from, to } = getHostStatDateRange(period, startDate, endDate);

  const stats = await models.HostStat.find({
    hostId: host._id,
    date: { $gte: from, $lte: to },
  })
    .sort({ date: 1 })
    .lean();

  const rows = groupHostStats(stats, period);

  const totals = rows.reduce(
    (accumulator, row) => {
      accumulator.visitors += safeNumber(row.visitors);
      accumulator.selfHostingHours += safeNumber(row.selfHostingHours);
      accumulator.selfHostingMinutes += safeNumber(row.selfHostingMinutes);
      accumulator.roomGifts += safeNumber(row.roomGifts);
      return accumulator;
    },
    {
      visitors: 0,
      selfHostingHours: 0,
      selfHostingMinutes: 0,
      roomGifts: 0,
    },
  );

  const currentCycle = await models.HostSalaryCycle.findOne({
    hostId: host._id,
  })
    .sort({ cycleEnd: -1, createdAt: -1 })
    .lean();

  return {
    period,
    from,
    to,
    totals,
    rows,
    currentCycle: currentCycle
      ? {
          _id: currentCycle._id,
          status: currentCycle.status,
          cycleStart: currentCycle.cycleStart,
          cycleEnd: currentCycle.cycleEnd,
          totalDiamonds: safeNumber(currentCycle.totalDiamonds),
          validDiamonds: safeNumber(currentCycle.validDiamonds),
          totalHostHours: safeNumber(currentCycle.totalHostHours),
          salaryPercentage: safeNumber(currentCycle.salaryPercentage),
          salaryUcoins: safeNumber(currentCycle.salaryUcoins),
          rewardGranted: Boolean(currentCycle.rewardGranted),
        }
      : null,
  };
};

/**
 * Create a new Host
 * -------------------------------
 * Takes:
 *   - customerRef (ObjectId of Customer)
 *  - agencyId (ObjectId of Agency)
 *
 * Generates:
 *   - unique hostId (auto-increment style)
 *   - joinDate as current date
 */
const createHost = async (req, res) => {
  try {
    const { customerRef, agencyId } = req.body;

    if (!customerRef || !agencyId) {
      return res.status(400).json({
        success: false,
        message: "customerRef and agencyId are required",
      });
    }

    // 🔹 Ensure Customer exists
    const customer = await models.Customer.findById(customerRef);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // 🔹 Ensure Customer is not already a Host
    const existingHost = await models.Host.findOne({ customerRef });
    if (existingHost) {
      return res.status(400).json({
        success: false,
        message: "Customer is already a host",
      });
    }

    // 🔹Ensure Agency exists
    const agency = await models.Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: "Agency not found",
      });
    }

    // 🔹 Generate unique hostId (max existing hostId + 1)
    const lastHost = await models.Host.findOne().sort({ hostId: -1 });
    const newHostId = lastHost ? Number(lastHost.hostId) + 1 : 10001;

    // 🔹 Create Host
    const newHost = await models.Host.create({
      customerRef,
      hostId: newHostId,
      joinDate: new Date(),
      agencyId: agencyId || null,
      status: "active",
    });

    // Update Customer to link to Host (if needed)
    customer.isHost = true;
    customer.hostRef = newHost._id;
    await customer.save();

    const agencyUpdate = await models.Agency.findByIdAndUpdate(
      agencyId,
      { $push: { hosts: newHost._id } },
      { new: true },
    );

    await newHost.populate("customerRef");
    await newHost.populate("agencyId");

    // update all room owned by customer to roomType 'host'
    await models.Room.updateMany(
      { ownerId: customerRef },
      { roomType: "host" },
    );

    return res.status(201).json({
      success: true,
      message: "Host created successfully",
      data: newHost,
    });
  } catch (error) {
    console.error("Error creating host:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get All Hosts
 * -------------------------------
 * Query params:
 *   - agencyId (optional) → filter by agency
 *   - status (optional)   → active | inactive | left
 */
const getAllHosts = async (req, res) => {
  try {
    const { agencyId, status } = req.query;

    const filter = {};
    if (agencyId) filter.agencyId = agencyId;
    if (status) filter.status = status;

    const hosts = await models.Host.find(filter)
      .populate("customerRef")
      .populate("agencyId");

    return res.status(200).json({
      success: true,
      count: hosts.length,
      data: hosts,
    });
  } catch (error) {
    console.error("Error fetching hosts:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getHostsByAgencyOwner = async (req, res) => {
  try {
    const { status } = req.query;
    const ownerUserId =
      req.user?._id || req.query.ownerUserId || req.body.ownerUserId;

    if (!ownerUserId) {
      return res.status(400).json({
        success: false,
        message: "ownerUserId is required",
      });
    }

    const { agencies, agencyIds } = await getAgencyOwnerScope(ownerUserId);

    if (!agencyIds.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        totalAgencies: agencies.length,
        data: [],
        agencies,
      });
    }

    const filter = {
      agencyId: { $in: agencyIds },
    };

    if (status) filter.status = status;

    const hosts = await models.Host.find(filter)
      .populate("customerRef")
      .populate("agencyId")
      .sort({ createdAt: -1 })
      .lean();

    const agencySummary = agencies.map((agency) => {
      const agencyId = toIdString(agency._id);
      const agencyHosts = hosts.filter(
        (host) => toIdString(host.agencyId?._id || host.agencyId) === agencyId,
      );

      return {
        _id: agency._id,
        agencyId: agency.agencyId,
        name: agency.name,
        status: agency.status,
        totalHosts: agencyHosts.length,
        activeHosts: agencyHosts.filter((host) => host.status === "active")
          .length,
      };
    });

    return res.status(200).json({
      success: true,
      count: hosts.length,
      totalAgencies: agencies.length,
      data: hosts,
      agencies: agencySummary,
    });
  } catch (error) {
    console.error("Error fetching hosts:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getHostDetailsByAgencyOwner = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = "monthly", startDate, endDate } = req.query;

    if (!["daily", "weekly", "monthly"].includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Invalid period. Must be daily, weekly, or monthly.",
      });
    }

    const ownerUserId =
      req.user?._id || req.query.ownerUserId || req.body.ownerUserId;

    if (!ownerUserId) {
      return res.status(400).json({
        success: false,
        message: "ownerUserId is required",
      });
    }

    const { ownerScope, host, isAllowed } = await getAgencyOwnerHostScope(
      ownerUserId,
      id,
    );

    if (!host) {
      return res.status(404).json({
        success: false,
        message: "Host not found",
      });
    }

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this host",
      });
    }

    const [summary, stats, leaveEligibility] = await Promise.all([
      buildHostDashboardSummary(host._id),
      buildHostDashboardStats({
        hostId: host._id,
        period,
        startDate,
        endDate,
      }),
      getHostLeaveEligibility(host),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ownerScope: {
          ownerUserId: toIdString(ownerUserId),
          agencyIds: ownerScope.agencyIds,
        },
        host: summary,
        statistics: stats,
        leaveEligibility,
      },
    });
  } catch (error) {
    console.error("Error fetching host details for agency owner:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const manageHostByAgencyOwner = async (req, res) => {
  try {
    const ownerUserId =
      req.user?._id || req.query.ownerUserId || req.body.ownerUserId;
    const { agencyId, customerRef, hostId } = req.body;

    if (!ownerUserId) {
      return res.status(400).json({
        success: false,
        message: "ownerUserId is required",
      });
    }

    if (!agencyId || !customerRef) {
      return res.status(400).json({
        success: false,
        message: "agencyId and customerRef are required",
      });
    }

    const { agencyIds } = await getAgencyOwnerScope(ownerUserId);
    if (!agencyIds.includes(toIdString(agencyId))) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this agency",
      });
    }

    const agency = await models.Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: "Agency not found",
      });
    }

    let host = null;
    if (hostId) {
      host = await resolveHostDocument(hostId);
    }

    if (!host) {
      host = await models.Host.findOne({ customerRef })
        .populate("customerRef")
        .populate("agencyId");
    }

    if (
      host &&
      toIdString(host.agencyId?._id || host.agencyId) === toIdString(agencyId)
    ) {
      await removeHostFromAgency(host);

      return res.status(200).json({
        success: true,
        action: "removed",
        message: "Host removed from agency successfully",
        data: {
          hostId: toIdString(host._id),
          customerRef: toIdString(customerRef),
          agencyId: toIdString(agencyId),
        },
      });
    }

    if (host) {
      return res.status(409).json({
        success: false,
        message: "Host already exists for this customer",
      });
    }

    const customer = await models.Customer.findById(customerRef);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const lastHost = await models.Host.findOne().sort({ hostId: -1 });
    const newHostId = lastHost ? Number(lastHost.hostId) + 1 : 10001;

    const newHost = await models.Host.create({
      customerRef,
      hostId: newHostId,
      joinDate: new Date(),
      agencyId,
      status: "active",
    });

    customer.isHost = true;
    customer.hostRef = newHost._id;
    await customer.save();

    await models.Agency.updateOne(
      { _id: agencyId },
      { $addToSet: { hosts: newHost._id } },
    );

    await newHost.populate("customerRef");
    await newHost.populate("agencyId");

    await models.Room.updateMany(
      { ownerId: customerRef },
      { roomType: "host" },
    );

    return res.status(201).json({
      success: true,
      action: "created",
      message: "Host created and linked to agency successfully",
      data: newHost,
    });
  } catch (error) {
    console.error("Error managing host by agency owner:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Host Details by ID
 * -------------------------------
 * Params:
 *   - id → MongoDB _id
 */
const getHostDetails = async (req, res) => {
  try {
    const { id } = req.params;

    let host;
    if (mongoose.isValidObjectId(id)) {
      host = await models.Host.findById(id)
        .populate("customerRef", "name") // only fetch 'name' from customer
        .populate("agencyId", "name"); // only fetch 'name' from agency
    } else {
      host = await models.Host.findOne({ hostId: id })
        .populate("customerRef", "name")
        .populate("agencyId", "name");
    }

    if (!host) {
      return res.status(404).json({
        success: false,
        message: "Host not found",
      });
    }

    const leftRequest = await models.JoinRequest.findOne({
      type: "leftRequest",
      hostId: host._id,
      status: "pending",
    });

    if (leftRequest) {
      host = host.toObject();
      host.leftRequestStatus = leftRequest.status;
      host.leftRequestId = leftRequest._id;
    }

    // ✅ Format clean response
    const responseData = {
      hostName: host.customerRef?.name || null,
      agencyId: host.agencyId?._id || null,
      agencyName: host.agencyId?.name || null,
      joinDate: host.joinDate,
      leftRequestStatus: host.leftRequestStatus || null,
      leftRequestId: host.leftRequestId || null,
    };

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching host details:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get all Join Requests
 * -------------------------------
 * Can be filtered by agency or host
 */
const getAllRequests = async (req, res) => {
  try {
    const { agencyId, hostId, customerId, status, type } = req.query;

    const filter = {};
    if (agencyId) filter.agencyId = agencyId;
    if (hostId) filter.hostId = hostId;
    if (customerId) filter.customerId = customerId;
    if (status) filter.status = status;
    if (type) filter.type = type;

    const requests = await models.JoinRequest.find(filter)
      .populate("agencyId")
      .populate("customerId")
      .populate("hostId");

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 1️⃣ Send Request from Customer → Agency
 * ----------------------------------------
 * Body:
 *   - customerId
 *   - agencyId
 *   - message (optional)
 */
const sendRequestFromCustomer = async (req, res) => {
  try {
    const { customerId, agencyId, message } = req.body;

    if (!customerId || !agencyId) {
      return res.status(400).json({
        success: false,
        message: "customerId and agencyId are required",
      });
    }

    // 🔹 Validate Customer & Agency
    const customer = await models.Customer.findById(customerId);
    if (!customer)
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });

    const agency = await models.Agency.findById(agencyId);
    if (!agency)
      return res
        .status(404)
        .json({ success: false, message: "Agency not found" });

    // 🔹 Check if existing pending/accepted request exists
    const existing = await models.JoinRequest.findOne({
      type: "fromCustomer",
      customerId,
      agencyId,
      status: { $in: ["pending", "accepted"] },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Request already sent or approved",
      });
    }

    // 🔹 Create Join Request
    const joinRequest = await models.JoinRequest.create({
      type: "fromCustomer",
      customerId,
      agencyId,
      message,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Request sent successfully",
      data: joinRequest,
    });
  } catch (error) {
    console.error("Error sending request:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2️⃣ Accept / Reject Request by Agency
 * ----------------------------------------
 * Params:
 *   - requestId
 * Body:
 *   - status: 'accepted' | 'rejected'
 */
const acceptOrRejectRequestByAgency = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'accepted' or 'rejected'",
      });
    }

    const request = await models.JoinRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Join request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Request already processed",
      });
    }

    // 🔹 Update request status
    request.status = status;
    await request.save();

    // ✅ If accepted, create Host entry
    if (status === "accepted") {
      const existingHost = await models.Host.findOne({
        customerRef: request.customerId,
      });
      if (!existingHost) {
        const lastHost = await models.Host.findOne().sort({ hostId: -1 });
        const newHostId = lastHost ? lastHost.hostId + 1 : 10001;

        const newHost = await models.Host.create({
          customerRef: request.customerId,
          hostId: newHostId,
          agencyId: request.agencyId,
          joinDate: new Date(),
          status: "active",
        });

        await newHost.populate("customerRef", "name");
      }
    }

    res.status(200).json({
      success: true,
      message: `Request ${status} successfully`,
      data: request,
    });
  } catch (error) {
    console.error("Error updating request:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3️⃣ Send Request from Agency → Customer
 * ----------------------------------------
 * Body:
 *   - agencyId
 *   - customerId
 *   - message (optional)
 */
const sendRequestFromAgency = async (req, res) => {
  try {
    const { agencyId, customerId, message } = req.body;

    if (!agencyId || !customerId) {
      return res.status(400).json({
        success: false,
        message: "agencyId and customerId are required",
      });
    }

    // 🔹 Validate Agency & Customer
    const agency = await models.Agency.findById(agencyId);
    if (!agency)
      return res
        .status(404)
        .json({ success: false, message: "Agency not found" });

    const customer = await models.Customer.findById(customerId);
    if (!customer)
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });

    // 🔹 Prevent duplicate/pending requests
    const existing = await models.JoinRequest.findOne({
      type: "fromAgency",
      agencyId,
      customerId,
      status: { $in: ["pending", "accepted"] },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Request already sent or approved",
      });
    }

    // 🔹 Create new join request
    const joinRequest = await models.JoinRequest.create({
      type: "fromAgency",
      agencyId,
      customerId,
      message,
      status: "pending",
    });

    // Add request to notification module

    const notification = await models.Notification.create({
      sentTo: [customer._id],
      notificationType: "agency",
      title: "New Host Request",
      message: `You have a new host request from agency ${agency.name}.`,
      data: {
        requestId: joinRequest._id.toString(),
        agencyName: agency.name,
        agencyId: agency._id.toString(),
      },
      image: agency.logo || null,
    });

    // push notification
    await notificationService.sendNotificationToCustomer({
      customerId: customer._id,
      title: "New Host Request",
      body: `You have a new host request from agency ${agency.name}.`,
      data: {
        requestId: joinRequest._id.toString(),
        agencyName: agency.name,
        agencyId: agency._id.toString(),
      },
    });

    io.to(toIdString(customer._id)).emit("notificationUpdate", notification);

    res.status(201).json({
      success: true,
      message: "Request sent successfully",
      data: joinRequest,
    });
  } catch (error) {
    console.error("Error sending request:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4️⃣ Accept / Reject Request by Customer
 * ----------------------------------------
 * Params:
 *   - requestId
 * Body:
 *   - status: 'accepted' | 'rejected'
 */
const acceptOrRejectRequestByCustomer = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'accepted' or 'rejected'",
      });
    }

    const request = await models.JoinRequest.findById(requestId)
      .populate("agencyId")
      .populate("customerId")
      .populate("hostId");
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Join request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Request already processed",
      });
    }

    request.status = status;
    await request.save();

    const agencyCustomerId =
      request.agencyId?.customerRef?._id ||
      request.agencyId?.customerRef ||
      null;
    const agencyId = request.agencyId?._id || request.agencyId || null;

    // send notification to agency about acceptance/rejection

    const notification = await models.Notification.create({
      sentTo: agencyCustomerId ? [agencyCustomerId] : [],
      notificationType: "agency",
      title: `Host Request ${status === "accepted" ? "Accepted" : "Rejected"}`,
      message: `Your host request to customer has been ${status}.`,
      data: {
        requestId: toIdString(request._id),
        customerId: toIdString(request.customerId),
        agencyId: toIdString(agencyId),
      },
      image: request.agencyId?.logo || null,
    });

    // push notification
    if (agencyCustomerId) {
      await notificationService.sendNotificationToCustomer({
        customerId: agencyCustomerId,
        title: `Host Request ${status === "accepted" ? "Accepted" : "Rejected"}`,
        body: `Your host request to customer has been ${status}.`,
        data: {
          requestId: toIdString(request._id),
          customerId: toIdString(request.customerId),
          agencyId: toIdString(agencyId),
        },
      });
      io.to(toIdString(agencyCustomerId)).emit(
        "notificationUpdate",
        notification,
      );
    }

    if (status === "rejected") {
      // remove fromAgency requests if any
      await models.JoinRequest.deleteMany({
        type: "fromAgency",
        agencyId: request.agencyId._id,
        customerId: request.customerId._id,
      });
    } else if (status === "accepted") {
      const existingHost = await models.Host.findOne({
        customerRef: request.customerId,
      });

      let newHost;
      if (!existingHost) {
        const lastHost = await models.Host.findOne().sort({ hostId: -1 });
        const newHostId = lastHost ? lastHost.hostId + 1 : 10001;

        newHost = await models.Host.create({
          customerRef: request.customerId,
          hostId: newHostId,
          agencyId: request.agencyId,
          joinDate: new Date(),
          status: "inactive",
        });

        await newHost.populate("customerRef", "name");

        const customer = await models.Customer.findById(request.customerId);

        // Update Customer to link to Host (if needed)
        customer.isHost = true;
        customer.hostRef = newHost._id;
        await customer.save();
        const agencyUpdate = await models.Agency.findByIdAndUpdate(
          request.agencyId,
          { $push: { hosts: newHost._id } },
          { new: true },
        );

        await newHost.populate("customerRef");
        await newHost.populate("agencyId");
      } else {
        // Update existing host to link to agency
        existingHost.agencyId = request.agencyId;
        existingHost.status = "inactive";
        await existingHost.save();
      }

      const ownerUser = await models.User.findById(request.agencyId.ownerUserId)
        .populate("customerRef")
        .populate("role");

      // update all room owned by customer to roomType 'host'
      await models.Room.updateMany(
        { ownerId: request.customerId },
        { roomType: "host" },
      );

      // create request for admin to review host addition

      await models.JoinRequest.create({
        type: "requestForAdminToReviewHost",
        agencyId: request.agencyId,
        customerId: request.customerId,
        hostId: existingHost ? existingHost._id : newHost._id,
        toUserId:
          ownerUser.role && ownerUser.role.name === "SubAdmin"
            ? ownerUser.parents.length > 0
              ? ownerUser.parents[ownerUser.parents.length - 1]
              : null
            : ownerUser.role && ownerUser.role.name === "Admin"
              ? ownerUser._id
              : null,
        message: "Request for admin to review new host addition",
        status: "pending",
      });

      // remove left requests if any
      await models.JoinRequest.deleteMany({
        type: "leftRequest",
        agencyId: request.agencyId,
        customerId: request.customerId,
      });
    }

    res.status(200).json({
      success: true,
      message: `Request ${status} successfully`,
      data: request,
    });
  } catch (error) {
    console.error("Error updating request:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendLeftAgencyRequest = async (req, res) => {
  try {
    const { hostId, message } = req.body;

    if (!hostId) {
      return res.status(400).json({
        success: false,
        message: "hostId is required",
      });
    }

    // 🔹 Find host and its agency
    const host = await models.Host.findById(hostId).populate("agencyId");
    if (!host) {
      return res.status(404).json({
        success: false,
        message: "Host not found",
      });
    }

    if (!host.agencyId) {
      return res.status(400).json({
        success: false,
        message: "Host is not assigned to any agency",
      });
    }

    const now = new Date();

    // if (!isLeaveApplicationWindow(now)) {
    //   return res.status(400).json({
    //     success: false,
    //     message:
    //       "You can only apply for leaving agency from 10th to 20th of every month",
    //   });
    // }

    // 🔹 Prevent duplicate left requests
    const existing = await hasAlreadyAppliedThisMonth(host._id, now);

    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          "You already used your one leave application chance for this month",
        status: existing.status,
      });
    }

    const eligibility = await getHostLeaveEligibility(host);

    // 🔹 Create new left request
    const newReq = await models.JoinRequest.create({
      type: "leftRequest",
      agencyId: host.agencyId._id,
      hostId: host._id,
      message: message || "Request to leave the agency",
      status: eligibility.canLeaveWithoutOwnerApproval ? "accepted" : "pending",
    });

    if (eligibility.canLeaveWithoutOwnerApproval) {
      await removeHostFromAgency(host, newReq);

      const ownerMessage = `Host with ID ${host.hostId} left your agency automatically because they met the leave conditions.`;
      await notifyHostLeftAgency({
        host,
        customerId:
          host.agencyId?.customerRef?._id || host.agencyId?.customerRef || null,
        agencyId: host.agencyId?._id || host.agencyId,
        message: ownerMessage,
      });

      return res.status(201).json({
        success: true,
        message: "Host left agency successfully without owner approval",
        data: {
          request: newReq,
          eligibility,
          autoApproved: true,
        },
      });
    }

    // Notify agency customer
    const agencyOwnerId =
      host.agencyId?.customerRef?._id || host.agencyId?.customerRef || null;
    const notification = await models.Notification.create({
      sentTo: agencyOwnerId ? [agencyOwnerId] : [],
      notificationType: "agency",
      title: "Host Left Agency Request",
      message: `Host with ID ${host.hostId} has requested to leave your agency.`,
      data: {
        requestId: toIdString(newReq._id),
        hostId: toIdString(host._id),
        agencyId: toIdString(host.agencyId?._id || host.agencyId),
      },
      image: host.agencyId?.logo || null,
    });

    // push notification
    if (agencyOwnerId) {
      await notificationService.sendNotificationToCustomer({
        customerId: agencyOwnerId,
        title: "Host Left Agency Request",
        body: `Host with ID ${host.hostId} has requested to leave your agency.`,
        data: {
          requestId: toIdString(newReq._id),
          hostId: toIdString(host._id),
          agencyId: toIdString(host.agencyId?._id || host.agencyId),
        },
      });

      io.to(toIdString(agencyOwnerId)).emit("notificationUpdate", notification);
    }

    res.status(201).json({
      success: true,
      message:
        "Leave request sent successfully. Agency owner approval is required.",
      data: {
        request: newReq,
        eligibility,
        autoApproved: false,
      },
    });
  } catch (error) {
    console.error("Error creating left agency request:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const respondToLeftRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action, must be 'accept' or 'reject'",
      });
    }

    // ✅ Find request
    const request = await models.JoinRequest.findById(requestId)
      .populate("agencyId")
      .populate("customerId")
      .populate("hostId");

    if (!request) {
      return res.status(200).json({
        success: false,
        message: "Request not found",
      });
    }

    if (request.type !== "leftRequest") {
      return res.status(400).json({
        success: false,
        message: "This request is not a left agency request",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Request has already been processed",
      });
    }

    if (action === "reject") {
      request.status = "rejected";
      await request.save();

      return res.status(200).json({
        success: true,
        message: "Left agency request rejected",
      });
    }

    // ✅ Accept: Delete host and unassign from agency
    const host = await models.Host.findById(request.hostId._id);
    if (!host) {
      return res.status(404).json({
        success: false,
        message: "Host not found",
      });
    }

    const { customerId, agencyId } = await removeHostFromAgency(host, request);

    await notifyHostLeftAgency({
      host,
      customerId,
      agencyId,
      message: `Your request to leave agency ${request.agencyId.name} has been accepted.`,
    });

    res.status(200).json({
      success: true,
      message: "Left agency request accepted, host unassigned and removed",
    });
  } catch (error) {
    console.error("Error responding to left agency request:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteHost = async (req, res) => {
  try {
    const { hostId } = req.params;

    if (!hostId) {
      return res.status(400).json({
        success: false,
        message: "hostId is required",
      });
    }

    // ✅ Check if host exists
    const host = await models.Host.findById(hostId).populate("agencyId");
    if (!host) {
      return res.status(404).json({
        success: false,
        message: "Host not found",
      });
    }

    // ✅ Delete the host
    await models.Host.findByIdAndDelete(hostId);

    // ✅ (Optional) Unassign logic — if you store host references in Agency model
    if (host.agencyId) {
      await models.Agency.updateOne(
        { _id: host.agencyId },
        { $pull: { hosts: host._id } }, // remove reference if stored
      );
    }

    res.status(200).json({
      success: true,
      message: `Host deleted and unassigned from agency.`,
    });
  } catch (error) {
    console.error("Error deleting host:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getHostDashboardSummary = async (req, res) => {
  try {
    const { hostId } = req.params;

    const summary = await buildHostDashboardSummary(hostId);
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "Host not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching host dashboard summary:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getHostDashboardStats = async (req, res) => {
  try {
    const { hostId } = req.params;
    const { period = "daily", startDate, endDate } = req.query;

    if (!["daily", "weekly", "monthly"].includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Invalid period. Must be daily, weekly, or monthly.",
      });
    }

    const stats = await buildHostDashboardStats({
      hostId,
      period,
      startDate,
      endDate,
    });

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: "Host not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching host dashboard stats:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getWeeksBetween = (fromDate, toDate) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const diffMs = to.getTime() - from.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 7);
};

const isLeaveApplicationWindow = (date = new Date()) => {
  const day = date.getDate();
  return day >= 10 && day <= 20;
};

const hasAlreadyAppliedThisMonth = async (hostId, date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

  const existing = await models.JoinRequest.findOne({
    type: "leftRequest",
    hostId,
    createdAt: { $gte: start, $lt: end },
  }).select("_id status createdAt");

  return existing;
};

const getHostLeaveEligibility = async (host) => {
  const now = new Date();
  const joinDate = host.joinDate || host.createdAt || now;
  const joinedWeeks = getWeeksBetween(joinDate, now);
  const joinedAtLeast24Weeks = joinedWeeks >= 24;

  const twentyFourWeeksAgo = new Date(now);
  twentyFourWeeksAgo.setDate(twentyFourWeeksAgo.getDate() - 24 * 7);

  const salaryCycles = await models.HostSalaryCycle.find({
    hostId: host._id,
    cycleStart: { $gte: twentyFourWeeksAgo, $lte: now },
  })
    .select("salaryUcoins")
    .lean();

  const accumulatedSalary = salaryCycles.reduce(
    (total, cycle) => total + safeNumber(cycle.salaryUcoins),
    0,
  );

  return {
    joinedWeeks,
    joinedAtLeast24Weeks,
    accumulatedSalary,
    meetsSalaryCap: accumulatedSalary < 200000,
    canLeaveWithoutOwnerApproval:
      joinedAtLeast24Weeks && accumulatedSalary < 200000,
  };
};

const removeHostFromAgency = async (host, request = null) => {
  const customerId = host.customerRef?._id || host.customerRef;
  const agencyId = host.agencyId?._id || host.agencyId;

  if (customerId) {
    const customer = await models.Customer.findById(customerId);
    if (customer) {
      customer.isHost = false;
      customer.hostRef = null;
      customer.agencyId = null;
      await customer.save();
    }
  }

  if (agencyId) {
    await models.Agency.updateOne(
      { _id: agencyId },
      { $pull: { hosts: host._id } },
    );

    await models.JoinRequest.deleteMany({
      type: "fromAgency",
      agencyId,
      customerId,
    });
  }

  await models.JoinRequest.deleteMany({
    type: "requestForAdminToReviewHost",
    hostId: host._id,
  });

  await models.Host.findByIdAndDelete(host._id);

  if (customerId) {
    await models.Room.updateMany(
      { ownerId: customerId },
      { roomType: "normal" },
    );
  }

  if (request) {
    request.status = "accepted";
    await request.save();
  }

  return { customerId, agencyId };
};

const notifyHostLeftAgency = async ({
  host,
  customerId,
  agencyId,
  message,
}) => {
  const agency = agencyId
    ? await models.Agency.findById(agencyId).lean()
    : null;

  const notification = await models.Notification.create({
    sentTo: customerId ? [customerId] : [],
    notificationType: "agency",
    title: "Left Agency Request Accepted",
    message,
    data: {
      hostId: toIdString(host._id),
      agencyId: toIdString(agencyId),
    },
    image: agency?.logo || null,
  });

  if (customerId) {
    io.to(toIdString(customerId)).emit("notificationUpdate", notification);

    await notificationService.sendNotificationToCustomer({
      customerId,
      title: "Left Agency Request Accepted",
      body: message,
      data: {
        hostId: toIdString(host._id),
        agencyId: toIdString(agencyId),
      },
    });
  }

  return notification;
};

module.exports = {
  createHost,
  getAllHosts,
  getHostDetails,
  getHostDashboardSummary,
  getHostDashboardStats,
  getHostDetailsByAgencyOwner,
  manageHostByAgencyOwner,
  sendLeftAgencyRequest,
  getAllRequests,
  sendRequestFromCustomer,
  acceptOrRejectRequestByAgency,
  sendRequestFromAgency,
  acceptOrRejectRequestByCustomer,
  respondToLeftRequest,
  deleteHost,
  getHostsByAgencyOwner,
};
