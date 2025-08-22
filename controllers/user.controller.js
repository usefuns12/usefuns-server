const bcrypt = require("bcryptjs");
const models = require("../models"); // adjust path as per your project

// ✅ Create a new User (linked to Customer & Role hierarchy)
const createUser = async (req, res) => {
  try {
    const { customerId, roleId, parents, password, country } = req.body;

    // 🔹 Validate required fields
    if (!customerId || !roleId || !country) {
      return res.status(400).json({
        success: false,
        message: "customerId, roleId and country are required",
      });
    }

    // 🔹 Ensure customer exists
    const customer = await models.Customer.findById(customerId);
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    // 🔹 Ensure role exists & is valid
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

    // 🔹 Create new user entry
    const newUser = await models.User.create({
      customerRef: customerId,
      role: roleId,
      parents: parents || [], // default empty array
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      country,
      isActive: true,
    });

    // 🔹 Populate customer for response
    await newUser.populate("customerRef");
    await newUser.populate("role");
    await newUser.populate("parents");

    // 🔹 Update parent-child relationships
    if (parents && parents.length > 0) {
      await models.User.updateMany(
        { _id: { $in: parents } },
        { $push: { children: newUser._id } }
      );
    }

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

// 🔹 Get user details
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
      .populate("parents") // parent users
      .populate("children") // child users
      .populate("ownedAgencies"); // owned agencies

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
