const mongoose = require("mongoose");
const models = require("../models");
const HostSalaryCycle = models.HostSalaryCycle;
const AgencyCommissionCycle = models.AgencyCommissionCycle;
const Host = models.Host;
const Agency = models.Agency;

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

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (hostId) filter.hostId = hostId;
    if (startDate || endDate) {
      filter.cycleStart = {};
      if (startDate) filter.cycleStart.$gte = new Date(startDate);
      if (endDate) filter.cycleStart.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    // Use batched hydration instead of per-row populate/lookups for faster rendering
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

    const hostIds = [...new Set(cycleDocs.map((cycle) => String(cycle.hostId)))];
    const hosts = await Host.find({ _id: { $in: hostIds } })
      .select("hostId customerRef totalHostTimeHours agencyId")
      .lean();

    const customerIds = [...new Set(hosts.map((host) => String(host.customerRef)))];
    const customers = await models.Customer.find({ _id: { $in: customerIds } })
      .select("name userId")
      .lean();

    const hostMap = new Map(hosts.map((host) => [String(host._id), host]));
    const customerMap = new Map(customers.map((customer) => [String(customer._id), customer]));

    const cycles = cycleDocs.map((cycle) => {
      const host = hostMap.get(String(cycle.hostId));
      const customer = host ? customerMap.get(String(host.customerRef)) : null;

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

    const cycleList = await HostSalaryCycle.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "hosts",
          localField: "hostId",
          foreignField: "_id",
          as: "hostDoc",
        },
      },
      {
        $unwind: {
          path: "$hostDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "hostDoc.customerRef",
          foreignField: "_id",
          as: "customerDoc",
        },
      },
      {
        $unwind: {
          path: "$customerDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "agencies",
          localField: "hostDoc.agencyId",
          foreignField: "_id",
          as: "agencyDoc",
        },
      },
      {
        $unwind: {
          path: "$agencyDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          hostId: {
            _id: "$hostDoc._id",
            hostId: "$hostDoc.hostId",
            totalHostTimeHours: "$hostDoc.totalHostTimeHours",
            agencyId: {
              _id: "$agencyDoc._id",
              agencyName: "$agencyDoc.agencyName",
            },
            customerRef: {
              _id: "$customerDoc._id",
              name: "$customerDoc.name",
              userId: "$customerDoc.userId",
            },
          },
        },
      },
      {
        $project: {
          hostDoc: 0,
          customerDoc: 0,
          agencyDoc: 0,
        },
      },
    ]);

    const cycle = cycleList[0] || null;

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found",
      });
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

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (agencyId) filter.agencyId = agencyId;
    if (startDate || endDate) {
      filter.cycleStart = {};
      if (startDate) filter.cycleStart.$gte = new Date(startDate);
      if (endDate) filter.cycleStart.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    // Use batched hydration instead of per-row populate/lookups for faster rendering
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

    const agencyIds = [...new Set(cycleDocs.map((cycle) => String(cycle.agencyId)))];
    const agencies = await Agency.find({ _id: { $in: agencyIds } })
      .select("agencyName ownerUserId countryCode")
      .lean();

    const agencyMap = new Map(agencies.map((agency) => [String(agency._id), agency]));

    const cycles = cycleDocs.map((cycle) => {
      const agency = agencyMap.get(String(cycle.agencyId));

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

    const cycleList = await AgencyCommissionCycle.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "agencies",
          localField: "agencyId",
          foreignField: "_id",
          as: "agencyDoc",
        },
      },
      {
        $unwind: {
          path: "$agencyDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          agencyId: {
            _id: "$agencyDoc._id",
            agencyName: "$agencyDoc.agencyName",
            ownerUserId: "$agencyDoc.ownerUserId",
            countryCode: "$agencyDoc.countryCode",
          },
        },
      },
      {
        $project: {
          agencyDoc: 0,
        },
      },
    ]);

    const cycle = cycleList[0] || null;

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Commission cycle not found",
      });
    }

    // Get host salary cycles that contributed to this commission
    if (cycle.calculation && cycle.calculation.hostCycles) {
      const hostCycles = await HostSalaryCycle.find({
        _id: { $in: cycle.calculation.hostCycles },
      })
        .populate({
          path: "hostId",
          select: "hostId customerRef agencyId",
          populate: {
            path: "customerRef",
            select: "name userId",
          },
        })
        .lean();

      cycle.contributingHosts = hostCycles;
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
