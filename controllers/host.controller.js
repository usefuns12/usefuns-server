const bcrypt = require("bcryptjs");
const models = require("../models");

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
    const newHostId = lastHost ? lastHost.hostId + 1 : 10001;

    // 🔹 Create Host
    const newHost = await models.Host.create({
      customerRef,
      hostId: newHostId,
      joinDate: new Date(),
      agencyId: agencyId || null,
      status: "active",
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

    // ✅ Format clean response
    const responseData = {
      hostName: host.customerRef?.name || null,
      agencyId: host.agencyId?._id || null,
      agencyName: host.agencyId?.name || null,
      joinDate: host.joinDate,
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
    const { agencyId, hostId, status } = req.query;

    const filter = {};
    if (agencyId) filter.fromAgencyId = agencyId;
    if (hostId) filter.toHostId = hostId;
    if (status) filter.status = status;

    const requests = await models.JoinRequest.find(filter)
      .populate("fromAgencyId", "name code")
      .populate("toHostId", "customerRef status")
      .populate("roomId", "name");

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
 * Accept Invitation
 * -------------------------------
 * Updates request status → accepted
 * Also links Host with Agency
 */
const acceptInvitation = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await models.JoinRequest.findById(requestId);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Request already processed",
      });
    }

    // Update request
    request.status = "accepted";
    await request.save();

    // Link host to agency
    const host = await models.Host.findById(request.toHostId);
    if (!host) {
      return res
        .status(404)
        .json({ success: false, message: "Host not found" });
    }

    host.agencyId = request.fromAgencyId;
    await host.save();

    // Update agency stats
    await models.Agency.findByIdAndUpdate(request.fromAgencyId, {
      $addToSet: { hosts: host._id },
      $inc: { "stats.totalHosts": 1, "stats.activeHosts": 1 },
    });

    res.status(200).json({
      success: true,
      message: "Invitation accepted, host added to agency",
      data: request,
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reject Invitation
 * -------------------------------
 * Updates request status → rejected
 */
const rejectInvitation = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await models.JoinRequest.findById(requestId);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Request already processed",
      });
    }

    request.status = "rejected";
    await request.save();

    res.status(200).json({
      success: true,
      message: "Invitation rejected",
      data: request,
    });
  } catch (error) {
    console.error("Error rejecting invitation:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createHost,
  getAllHosts,
  getHostDetails,
  getAllRequests,
  acceptInvitation,
  rejectInvitation,
};
