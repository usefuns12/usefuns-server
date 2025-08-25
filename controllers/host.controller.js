const bcrypt = require("bcryptjs");
const models = require("../models");

/**
 * Create a new Host
 * -------------------------------
 * Takes:
 *   - customerRef (ObjectId of Customer)
 *   - password (plain text, will be hashed)
 *
 * Generates:
 *   - unique hostId (auto-increment style)
 *   - joinDate as current date
 */
const createHost = async (req, res) => {
  try {
    const { customerRef, password } = req.body;

    if (!customerRef || !password) {
      return res.status(400).json({
        success: false,
        message: "customerRef and password are required",
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

    // 🔹 Generate unique hostId (max existing hostId + 1)
    const lastHost = await models.Host.findOne().sort({ hostId: -1 });
    const newHostId = lastHost ? lastHost.hostId + 1 : 10001;

    // 🔹 Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 🔹 Create Host
    const newHost = await models.Host.create({
      customerRef,
      hostId: newHostId,
      joinDate: new Date(),
      agencyId: null,
      status: "active",
      passwordHash,
    });

    await newHost.populate("customerRef");

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

/**
 * Get Host Details by ID
 * -------------------------------
 * Params:
 *   - id → MongoDB _id or hostId
 */
const getHostDetails = async (req, res) => {
  try {
    const { id } = req.params;

    let host;
    if (mongoose.isValidObjectId(id)) {
      host = await models.Host.findById(id)
        .populate("customerRef")
        .populate("agencyId")
        .populate("roomId");
    } else {
      host = await models.Host.findOne({ hostId: id })
        .populate("customerRef")
        .populate("agencyId")
        .populate("roomId");
    }

    if (!host) {
      return res.status(404).json({
        success: false,
        message: "Host not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: host,
    });
  } catch (error) {
    console.error("Error fetching host details:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createHost,
  getAllHosts,
  getHostDetails,
};
