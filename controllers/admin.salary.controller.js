const mongoose = require("mongoose");
const models = require("../models");

const HostSalaryCycle = models.HostSalaryCycle;
const AgencyCommissionCycle = models.AgencyCommissionCycle;
const Host = models.Host;
const Agency = models.Agency;

function normalizeObjectId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

async function hydrateSalaryCycles(cycleDocs) {
  const hostIds = [
    ...new Set(
      cycleDocs.map((cycle) => normalizeObjectId(cycle.hostId)).filter(Boolean)
    ),
  ];

  const hosts = await Host.find({ _id: { $in: hostIds } })
    .select("hostId customerRef totalHostTimeHours agencyId")
    .lean();

  const customerIds = [
    ...new Set(
      hosts.map((host) => normalizeObjectId(host.customerRef)).filter(Boolean)
    ),
  ];

  const customers = await models.Customer.find({ _id: { $in: customerIds } })
    .select("name userId")
    .lean();

  const hostMap = new Map(hosts.map((host) => [String(host._id), host]));
  const customerMap = new Map(
    customers.map((customer) => [String(customer._id), customer])
  );

  return cycleDocs.map((cycle) => {
    const hostId = normalizeObjectId(cycle.hostId);
    const host = hostId ? hostMap.get(hostId) : null;
    const customer = host
      ? customerMap.get(normalizeObjectId(host.customerRef))
      : null;

    return {
      ...cycle,
      hostId: host
        ? {
            _id: host._id,
            hostId: host.hostId,
            totalHostTimeHours: host.totalHostTimeHours,
            agencyId: host.agencyId,
            customerRef: customer
              ? {
                  _id: customer._id,
                  name: customer.name,
                  userId: customer.userId,
                }
              : null,
          }
        : null,
    };
  });
}

async function hydrateCommissionCycles(cycleDocs) {
  const agencyIds = [
    ...new Set(
      cycleDocs.map((cycle) => normalizeObjectId(cycle.agencyId)).filter(Boolean)
    ),
  ];

  const agencies = await Agency.find({ _id: { $in: agencyIds } })
    .select("agencyName ownerUserId countryCode")
    .lean();

  const agencyMap = new Map(agencies.map((agency) => [String(agency._id), agency]));

  return cycleDocs.map((cycle) => {
    const agencyId = normalizeObjectId(cycle.agencyId);
    const agency = agencyId ? agencyMap.get(agencyId) : null;

    return {
      ...cycle,
      agencyId: agency
        ? {
            _id: agency._id,
            agencyName: agency.agencyName,
            ownerUserId: agency.ownerUserId,
            countryCode: agency.countryCode,
          }
        : null,
    };
  });
}

/**
 * Get all salary cycles with filters and pagination
 * GET /admin/salary-cycles?page=1&limit=20&status=calculated&hostId=xxx&startDate=xxx&endDate=xxx
 */
exports.getSalaryCycles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      hostId,
      startDate,
      endDate,
      sortBy = "cycleStart",
      sortOrder = "desc",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    const normalizedHostId = normalizeObjectId(hostId);
    if (normalizedHostId) filter.hostId = normalizedHostId;
    if (startDate || endDate) {
      filter.cycleStart = {};
      if (startDate) filter.cycleStart.$gte = new Date(startDate);
      if (endDate) filter.cycleStart.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [cycleDocs, total] = await Promise.all([
      HostSalaryCycle.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Object.keys(filter).length === 0
        ? HostSalaryCycle.estimatedDocumentCount()
        : HostSalaryCycle.countDocuments(filter),
    ]);

    const cycles = await hydrateSalaryCycles(cycleDocs);

    res.json({
      success: true,
      data: {
        cycles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching salary cycles:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch salary cycles",
      error: error.message,
    });
  }
};

/**
 * Get single salary cycle by ID with full details
 * GET /admin/salary-cycles/:id
 */
exports.getSalaryCycleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary cycle id",
      });
    }

    const cycle = await HostSalaryCycle.findById(id).lean();

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found",
      });
    }

    const hostId = normalizeObjectId(cycle.hostId);
    const host = hostId
      ? await Host.findById(hostId)
          .select("hostId customerRef totalHostTimeHours agencyId")
          .lean()
      : null;

    if (host) {
      const [customer, agency] = await Promise.all([
        host.customerRef
          ? models.Customer.findById(normalizeObjectId(host.customerRef))
              .select("name userId")
              .lean()
          : Promise.resolve(null),
        host.agencyId
          ? Agency.findById(normalizeObjectId(host.agencyId))
              .select("agencyName")
              .lean()
          : Promise.resolve(null),
      ]);

      cycle.hostId = {
        _id: host._id,
        hostId: host.hostId,
        totalHostTimeHours: host.totalHostTimeHours,
        agencyId: agency
          ? {
              _id: agency._id,
              agencyName: agency.agencyName,
            }
          : null,
        customerRef: customer
          ? {
              _id: customer._id,
              name: customer.name,
              userId: customer.userId,
            }
          : null,
      };
    } else {
      cycle.hostId = null;
    }

    res.json({
      success: true,
      data: cycle,
    });
  } catch (error) {
    console.error("Error fetching salary cycle:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch salary cycle",
      error: error.message,
    });
  }
};

/**
 * Get all agency commission cycles with filters and pagination
 * GET /admin/agency-commissions?page=1&limit=20&status=calculated&agencyId=xxx&startDate=xxx&endDate=xxx
 */
exports.getAgencyCommissions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      agencyId,
      startDate,
      endDate,
      sortBy = "cycleStart",
      sortOrder = "desc",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    const normalizedAgencyId = normalizeObjectId(agencyId);
    if (normalizedAgencyId) filter.agencyId = normalizedAgencyId;
    if (startDate || endDate) {
      filter.cycleStart = {};
      if (startDate) filter.cycleStart.$gte = new Date(startDate);
      if (endDate) filter.cycleStart.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [cycleDocs, total] = await Promise.all([
      AgencyCommissionCycle.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Object.keys(filter).length === 0
        ? AgencyCommissionCycle.estimatedDocumentCount()
        : AgencyCommissionCycle.countDocuments(filter),
    ]);

    const cycles = await hydrateCommissionCycles(cycleDocs);

    res.json({
      success: true,
      data: {
        cycles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching agency commissions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agency commissions",
      error: error.message,
    });
  }
};

/**
 * Get single agency commission cycle by ID with full details
 * GET /admin/agency-commissions/:id
 */
exports.getAgencyCommissionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid commission cycle id",
      });
    }

    const cycle = await AgencyCommissionCycle.findById(id).lean();

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Commission cycle not found",
      });
    }

    const agencyId = normalizeObjectId(cycle.agencyId);
    const agency = agencyId
      ? await Agency.findById(agencyId)
          .select("agencyName ownerUserId countryCode")
          .lean()
      : null;

    cycle.agencyId = agency
      ? {
          _id: agency._id,
          agencyName: agency.agencyName,
          ownerUserId: agency.ownerUserId,
          countryCode: agency.countryCode,
        }
      : null;

    if (cycle.calculation && cycle.calculation.hostCycles) {
      const hostCycleIds = cycle.calculation.hostCycles
        .map((item) => normalizeObjectId(item))
        .filter(Boolean);

      const hostCycles = await HostSalaryCycle.find({
        _id: { $in: hostCycleIds },
      }).lean();

      cycle.contributingHosts = await hydrateSalaryCycles(hostCycles);
    }

    res.json({
      success: true,
      data: cycle,
    });
  } catch (error) {
    console.error("Error fetching agency commission:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agency commission",
      error: error.message,
    });
  }
};

/**
 * Get salary cycle statistics
 * GET /admin/salary-cycles/stats
 */
exports.getSalaryCycleStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.cycleStart = {};
      if (startDate) filter.cycleStart.$gte = new Date(startDate);
      if (endDate) filter.cycleStart.$lte = new Date(endDate);
    }

    const stats = await HostSalaryCycle.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalSalary: { $sum: "$salaryUcoins" },
          avgSalary: { $avg: "$salaryUcoins" },
        },
      },
    ]);

    const totalStats = await HostSalaryCycle.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCycles: { $sum: 1 },
          totalSalaryPaid: { $sum: "$salaryUcoins" },
          avgSalary: { $avg: "$salaryUcoins" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        byStatus: stats,
        overall: totalStats[0] || {
          totalCycles: 0,
          totalSalaryPaid: 0,
          avgSalary: 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching salary stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch salary statistics",
      error: error.message,
    });
  }
};

/**
 * Get agency commission statistics
 * GET /admin/agency-commissions/stats
 */
exports.getAgencyCommissionStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.cycleStart = {};
      if (startDate) filter.cycleStart.$gte = new Date(startDate);
      if (endDate) filter.cycleStart.$lte = new Date(endDate);
    }

    const stats = await AgencyCommissionCycle.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalCommission: { $sum: "$commissionUcoins" },
          avgCommission: { $avg: "$commissionUcoins" },
        },
      },
    ]);

    const totalStats = await AgencyCommissionCycle.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCycles: { $sum: 1 },
          totalCommissionPaid: { $sum: "$commissionUcoins" },
          avgCommission: { $avg: "$commissionUcoins" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        byStatus: stats,
        overall: totalStats[0] || {
          totalCycles: 0,
          totalCommissionPaid: 0,
          avgCommission: 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching commission stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch commission statistics",
      error: error.message,
    });
  }
};
