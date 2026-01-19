const bcrypt = require("bcryptjs");
const models = require("../models");

// ✅ Create a new User (linked to Customer & Role hierarchy)
const createUser = async (req, res) => {
  try {
    const { customerId, roleId, parents, password, country } = req.body;

    // 🔹 Validate required fields
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

    // 🔹 Determine country
    let finalCountry = country;
    if (parents && parents.length > 0) {
      const parentUser = await models.User.findById(parents[0]);
      if (!parentUser) {
        return res.status(400).json({
          success: false,
          message: `Parent user with id ${parents[0]} not found`,
        });
      }
      finalCountry = parentUser.country;
    }

    // 🔹 Create new user entry
    const newUser = await models.User.create({
      customerRef: customerId,
      role: roleId,
      parents: parents || [],
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      country: finalCountry,
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

// Get User Details by token
const getUserDetailsByToken = async (req, res) => {
  try {
    const id = req.user._id;

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

// ✅ Get all users by role name
const getAllUsersByRole = async (req, res) => {
  try {
    const { role } = req.query;

    let users;

    if (!role) {
      // 🔹 No role provided → return all users
      users = await models.User.find({})
        .populate("customerRef")
        .populate("role")
        .populate("parents")
        .populate("children")
        .populate("ownedAgencies");
    } else {
      // 🔹 Find role by name
      const roleDoc = await models.Role.findOne({ name: role });
      if (!roleDoc) {
        return res.status(404).json({
          success: false,
          message: `Role '${role}' not found`,
        });
      }

      // 🔹 Fetch users with that role
      users = await models.User.find({ role: roleDoc._id })
        .populate("customerRef")
        .populate("role")
        .populate("parents")
        .populate("children")
        .populate("ownedAgencies");
    }

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users by role:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get all users by role AND parent user ID
const getAllUsersByRoleAndParentId = async (req, res) => {
  try {
    let { role, parentId } = req.query;

    if (!parentId) {
      parentId = req.user?._id; // assumes userAuth middleware populates req.user
    }

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Parent user not found in token.",
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required in query parameters.",
      });
    }

    // 🔹 Find role by name
    const roleDoc = await models.Role.findOne({ name: role });
    if (!roleDoc) {
      return res.status(404).json({
        success: false,
        message: `Role '${role}' not found.`,
      });
    }

    // 🔹 Find users with given role AND where 'parents' array contains parentId
    const users = await models.User.find({
      role: roleDoc._id,
      parents: parentId,
    })
      .populate("customerRef")
      .populate("role")
      .populate("parents")
      .populate("children")
      .populate("ownedAgencies");

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users by role and parentId:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Get all Country Admin users by countryManagerId
const getAllCountryAdminsByManager = async (req, res) => {
  try {
    const { countryManagerId } = req.query;

    if (!countryManagerId) {
      return res.status(400).json({
        success: false,
        message:
          "countryManagerId is required as query param ?countryManagerId=",
      });
    }

    // 🔹 Find Country Admin role
    const countryAdminRole = await models.Role.findOne({
      name: "CountryAdmin",
    });
    if (!countryAdminRole) {
      return res.status(404).json({
        success: false,
        message: "Role 'CountryAdmin' not found",
      });
    }

    // 🔹 Fetch users who are countryAdmin AND have the given manager in their parents array
    const users = await models.User.find({
      role: countryAdminRole._id,
      parents: countryManagerId, // check if exists in array
    })
      .populate("customerRef")
      .populate("role")
      .populate("parents")
      .populate("children")
      .populate("ownedAgencies");

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching country admins by manager:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get all Admin users by countryAdminId
const getAllAdminsByCountryAdmin = async (req, res) => {
  try {
    const { countryAdminId } = req.query;

    if (!countryAdminId) {
      return res.status(400).json({
        success: false,
        message: "countryAdminId is required as query param ?countryAdminId=",
      });
    }

    // 🔹 Find Admin role
    const adminRole = await models.Role.findOne({ name: "Admin" });
    if (!adminRole) {
      return res.status(404).json({
        success: false,
        message: "Role 'Admin' not found",
      });
    }

    // 🔹 Fetch users who are admin AND have the given countryAdmin in their parents array
    const users = await models.User.find({
      role: adminRole._id,
      parents: countryAdminId, // check if countryAdminId exists in parents array
    })
      .populate("customerRef")
      .populate("role")
      .populate("parents")
      .populate("children")
      .populate("ownedAgencies");

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching admins by countryAdmin:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Delete user by ID
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await models.User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 🔹 Remove from parent-child relationships
    if (user.parents.length > 0) {
      await models.User.updateMany(
        { _id: { $in: user.parents } },
        { $pull: { children: user._id } }
      );
    }
    if (user.children.length > 0) {
      await models.User.updateMany(
        { _id: { $in: user.children } },
        { $pull: { parents: user._id } }
      );
    }

    await models.User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Update user by ID
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId, parents, password, country, isActive } = req.body;

    const user = await models.User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (roleId) {
      const role = await models.Role.findById(roleId);
      if (!role) {
        return res
          .status(404)
          .json({ success: false, message: "Role not found" });
      }
      user.role = roleId;
    }

    if (country) user.country = country;
    if (typeof isActive !== "undefined") user.isActive = isActive;
    if (password) user.passwordHash = await bcrypt.hash(password, 10);

    // 🔹 Reset and update parents (if provided)
    if (parents) {
      // remove from old parents
      await models.User.updateMany(
        { _id: { $in: user.parents } },
        { $pull: { children: user._id } }
      );

      user.parents = parents;

      // add to new parents
      await models.User.updateMany(
        { _id: { $in: parents } },
        { $addToSet: { children: user._id } }
      );
    }

    await user.save();
    await user.populate("customerRef role parents children ownedAgencies");

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get all admin review requests
const getAllAdminReviewRequests = async (req, res) => {
  try {
    const adminId = req.user._id;

    const requests = await models.JoinRequest.find({
      type: {
        $in: ["requestForAdminToReviewAgency", "requestForAdminToReviewHost"],
      },
      toUserId: adminId,
      status: "pending",
    })
      .populate("agencyId")
      .populate("hostId")
      .populate("toUserId")
      .populate("customerId");
    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("Error fetching admin review requests:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Accept/Reject admin review requests
const acceptAdminReviewRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const request = await models.JoinRequest.findById(requestId);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Join request not found" });
    }
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be either 'accept' or 'reject'",
      });
    }
    request.status = action === "accept" ? "accepted" : "rejected";
    await request.save();

    if (action === "accept") {
      // If it's an agency review request
      if (
        request.type === "requestForAdminToReviewAgency" &&
        request.agencyId
      ) {
        const agency = await models.Agency.findById(request.agencyId);
        if (agency) {
          agency.status = "active";
          await agency.save();
        }
      }
      // If it's a host review request
      else if (
        request.type === "requestForAdminToReviewHost" &&
        request.hostId
      ) {
        const host = await models.Host.findById(request.hostId);
        if (host) {
          host.status = "active";
          await host.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Request ${action}ed successfully`,
      data: request,
    });
  } catch (error) {
    console.error("Error processing admin review request:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createUser,
  getUserDetails,
  updateUser,
  deleteUser,
  getAllUsersByRole,
  getAllCountryAdminsByManager,
  getAllAdminsByCountryAdmin,
  getUserDetailsByToken,
  getAllUsersByRoleAndParentId,
  getAllAdminReviewRequests,
  acceptAdminReviewRequest,
};
