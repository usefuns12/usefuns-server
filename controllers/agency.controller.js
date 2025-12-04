const models = require("../models"); // adjust path

// ✅ 1. Create Agency
const createAgency = async (req, res) => {
  try {
    const { agencyId, name, ownerUserId, customerRef } = req.body;

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
    const owner = await models.User.findById(ownerUserId).populate(
      "customerRef"
    );
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

// ✅ 1. Create Agency
const createAgencyByAuthenticatedUser = async (req, res) => {
  try {
    const ownerUserId = req.user._id;

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
    const owner = await models.User.findById(ownerUserId).populate(
      "customerRef"
    );
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
      .populate("ownerUserId", "customerRef role") // show basic owner info
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
      .populate("ownerUserId", "customerRef role") // show basic owner info
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
      .populate("ownerUserId", "customerRef role")
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
      .populate("ownerUserId", "customerRef role")
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

    const agency = await models.Agency.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

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
};
