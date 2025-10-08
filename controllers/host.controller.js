const bcrypt = require("bcryptjs");
const models = require("../models");
const mongoose = require("mongoose");

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

    request.status = status;
    await request.save();

    // ✅ If accepted, create Host
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

const sendLeftAgencyRequest = async (req, res) => {
  try {
    const { hostId, message } = req.body;

    if (!hostId) {
      return res.status(400).json({
        success: false,
        message: "hostId is required",
      });
    }

    // ✅ Find host
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

    // ✅ Prevent duplicate left requests
    const existing = await models.JoinRequest.findOne({
      type: "leftRequest",
      toHostId: host._id,
      fromAgencyId: host.agencyId._id,
      status: "pending",
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A leave request is already pending for this host",
      });
    }

    // ✅ Create new left request
    const newReq = await models.JoinRequest.create({
      type: "leftRequest",
      fromAgencyId: host.agencyId._id,
      toHostId: host._id,
      status: "pending",
      message: message || "Request to leave the agency",
    });

    res.status(201).json({
      success: true,
      message: "Left agency request sent successfully",
      data: newReq,
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
      .populate("toHostId")
      .populate("fromAgencyId");

    if (!request) {
      return res.status(404).json({
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
    const host = await models.Host.findById(request.toHostId._id);
    if (!host) {
      return res.status(404).json({
        success: false,
        message: "Host not found",
      });
    }

    // Delete host record
    await models.Host.findByIdAndDelete(host._id);

    // Update request status
    request.status = "accepted";
    await request.save();

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

module.exports = {
  createHost,
  getAllHosts,
  getHostDetails,
  sendLeftAgencyRequest,
  getAllRequests,
  sendRequestFromCustomer,
  acceptOrRejectRequestByAgency,
  sendRequestFromAgency,
  acceptOrRejectRequestByCustomer,
  respondToLeftRequest,
};
