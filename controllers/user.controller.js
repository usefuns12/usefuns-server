const models = require("../models");
const bcrypt = require("bcryptjs");

// Create a new User (linked to Customer)
const createUser = async (req, res) => {
  try {
    const { customerId, roleId, roleRef, password, hostId, displayName } =
      req.body;

    if (!customerId || !roleId) {
      return res.status(400).json({
        success: false,
        message: "customerId and roleId are required",
      });
    }

    // 🔹 Ensure customer exists
    const customer = await models.Customer.findById(customerId);
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    // 🔹 Ensure role exists
    const role = await models.Role.findById(roleId);
    if (!role) {
      return res
        .status(404)
        .json({ success: false, message: "Role not found" });
    }

    // 🔹 Check if user already exists for this customer
    const existingUser = await models.User.findOne({ customerRef: customerId });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists for this customer",
      });
    }

    // 🔹 Create new user
    const newUser = await models.User.create({
      customerRef: customerId,
      role: roleId,
      roleRef: roleRef || null,
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      isActive: true,
    });

    // Auto-populate customerRef
    await newUser.populate("customerRef");

    // 🔹 If role is Host, also create Host entry
    if (role.name === "Host") {
      if (!hostId) {
        return res.status(400).json({
          success: false,
          message: "hostId is required when creating a Host user",
        });
      }

      const existingHost = await models.Host.findOne({ hostId });
      if (existingHost) {
        return res.status(400).json({
          success: false,
          message: "Host with this hostId already exists",
        });
      }

      const newHost = await models.Host.create({
        userId: newUser._id,
        hostId,
        displayName: displayName || customer.name,
        joinDate: new Date(),
        agencyId: roleRef || null, // if linked to an agency
        status: "active",
      });

      return res.status(201).json({
        success: true,
        message: "Host user created successfully",
        data: { user: newUser, host: newHost },
      });
    }

    // 🔹 Default response for non-host users
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: newUser,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    // 🔹 Find user by ID and populate relations
    const user = await models.User.findById(id)
      .populate("customerRef") // auto user profile from customers
      .populate("role") // role details
      .populate("roleRef"); // agency/seller/merchant ref (optional)

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createUser, getUserDetails };
