/**
 * Agency Routes
 * -------------------------------
 * Handles all endpoints related to Agencies in the system.
 *
 * Endpoints:
 *  - POST   /agencies/create           → Create a new Agency
 *  - GET    /agencies/:id              → Get Agency details by ID
 *  - GET    /agencies/owner/:ownerId   → Get all Agencies created by a specific Owner (User)
 *
 * Middleware:
 *  - You can add auth middlewares later (e.g. only Admin/SubAdmin can create agencies)
 */

const express = require("express");
const agencyController = require("../controllers/agency.controller");
const middleware = require("../middlewares");

const router = express.Router();

// Create a new Agency
router.route("/create").post(
  // Example: restrict to Admin/SubAdmin
  // middleware.auth.authAdmin,
  agencyController.createAgency
);

// Get All Agencies
router.route("/").get(
  // middleware.auth.authAdmin,
  agencyController.getAllAgencies
);

// Get Agency details by ID
router.route("/:id").get(
  // middleware.auth.authAdmin,
  agencyController.getAgencyById
);

// Get all Agencies by Owner UserId
router.route("/owner/:ownerUserId").get(
  // middleware.auth.authAdmin,
  agencyController.getAgenciesByOwner
);

// Invite Host to Agency
router.post(
  "/invite-host",
  // middleware.auth.authAgency, // enable later
  agencyController.inviteHostToAgency
);

// Update Agency by ID
router.route("/:id").put(
  // middleware.auth.authAdmin,
  agencyController.updateAgency
);

// Delete Agency by ID
router.route("/:id").delete(
  // middleware.auth.authAdmin,
  agencyController.deleteAgency
);

module.exports = router;
