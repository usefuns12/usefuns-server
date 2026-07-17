const express = require("express");
const router = express.Router();
const { userAuth, userAuthorize } = require("../middlewares/auth");
const authController = require("../controllers/auth.controller");

// 🔹 Login
router.post("/login", authController.login);

// 🔹 Get current user profile
router.get("/profile", userAuth, authController.getProfile);

// 🔹 Logout (no server storage)
router.post("/logout", userAuth, authController.logout);

// Example: restricted route (for CountryAdmin only)
router.get(
  "/admin-zone",
  userAuth,
  userAuthorize("CountryAdmin", "Admin"),
  (req, res) => {
    res.json({ success: true, message: "Welcome to admin zone!" });
  }
);

module.exports = router;
