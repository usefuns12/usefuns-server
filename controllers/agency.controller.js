const models = require("../models"); // adjust path

// ✅ 1. Create Agency
const createAgency = async (req, res) => {
  try {
    const { agencyId, code, name, ownerUserId, country } = req.body;

    if (!agencyId || !name || !ownerUserId || !country) {
      return res.status(400).json({
        success: false,
        message: "agencyId, name, ownerUserId and country are required",
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
    const owner = await models.User.findById(ownerUserId);
    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: "Owner user not found" });
    }

    // Create agency
    const newAgency = await models.Agency.create({
      agencyId,
      code,
      name,
      ownerUserId,
      country,
      hosts: [],
      stats: { totalHosts: 0, activeHosts: 0, newHosts: 0 },
    });

    return res.status(201).json({
      success: true,
      message: "Agency created successfully",
      data: newAgency,
    });
  } catch (error) {
    console.error("Error creating agency:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ 2. Get Agency Details by ID
const getAgencyById = async (req, res) => {
  try {
    const { id } = req.params;

    const agency = await models.Agency.findById(id)
      .populate("ownerUserId", "customerRef role") // show basic owner info
      .populate("hosts"); // show hosts linked to agency

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

    const agencies = await models.Agency.find({ ownerUserId }).populate(
      "hosts"
    );

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

module.exports = {
  createAgency,
  getAgencyById,
  getAgenciesByOwner,
};
