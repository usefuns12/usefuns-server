const bcrypt = require("bcryptjs");
const models = require("../models");
const { generateToken } = require("../utils/jwt");

// 🔹 User Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 🔹 Find customer by email
    const customer = await models.Customer.findOne({ email: email });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // 🔹 Find user linked to this customer
    const user = await models.User.findOne({ customerRef: customer._id })
      .populate("role")
      .populate("customerRef");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        success: false,
        message: "User has no password set",
      });
    }

    // 🔹 Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 🔹 Generate JWT
    const token = generateToken({
      id: user._id,
      role: user.role.name,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: user,
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔹 Get Current Authenticated User
const getProfile = async (req, res) => {
  try {
    const user = req.user; // from auth middleware
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔹 Logout (client can just remove token)
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Logout successful (token invalidated on client)",
  });
};

module.exports = { login, getProfile, logout };
