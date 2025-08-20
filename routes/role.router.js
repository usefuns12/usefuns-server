/**
 * Role Routes
 * -------------------------------
 * Handles initialization and retrieval of application roles.
 *
 * Endpoints:
 *  - POST /roles/init     → One-time initializer to create or update roles
 *                           (CountryManager, Admin, SubAdmin, Agency, Host, etc.)
 *  - GET  /roles          → Fetch all roles (with permissions and canCreate hierarchy)
 */

const express = require("express");
const { initRoles, getAllRoles } = require("../controllers/roleController");
const middleware = require("../middlewares");

const router = express.Router();

// One-time initializer for roles
router.route("/init").post(
  // Example: only super admin should call this
  // middleware.auth.authAdmin,
  initRoles
);

// Get all roles
router.route("/").get(
  // middleware.auth.authAdmin, // if restricted
  getAllRoles
);

module.exports = router;
