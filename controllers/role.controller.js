const models = require("../models");

// One-time initializer for roles
const initRoles = async (req, res) => {
  try {
    // 🔹 Define roles according to PDF hierarchy
    const rolesData = [
      {
        name: "CountryManager",
        permissions: ["*"], // full access
        canCreate: ["CountryAdmin", "Admin", "SubAdmin", "Agency"],
      },
      {
        name: "CountryAdmin",
        permissions: ["manage-country"],
        canCreate: ["Admin", "SubAdmin", "Agency", "Host"],
      },
      {
        name: "Admin",
        permissions: ["manage-admin"],
        canCreate: ["SubAdmin", "Agency", "Host"],
      },
      {
        name: "SubAdmin",
        permissions: ["manage-subadmin"],
        canCreate: ["Agency", "Host"],
      },
    ];

    const results = [];

    for (const roleData of rolesData) {
      const existingRole = await models.Role.findOne({ name: roleData.name });

      if (existingRole) {
        // 🔹 Update existing role
        existingRole.permissions = roleData.permissions;
        existingRole.canCreate = roleData.canCreate;
        await existingRole.save();
        results.push({ role: roleData.name, status: "updated" });
      } else {
        // 🔹 Create new role
        await models.Role.create(roleData);
        results.push({ role: roleData.name, status: "created" });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Roles initialized/updated successfully",
      results,
    });
  } catch (error) {
    console.error("Error initializing roles:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all roles
const getAllRoles = async (req, res) => {
  try {
    const roles = await models.Role.find().sort({ name: 1 }); // sort alphabetically

    return res.status(200).json({
      success: true,
      count: roles.length,
      data: roles,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { initRoles, getAllRoles };
