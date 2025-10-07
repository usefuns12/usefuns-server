/**
 * Host Routes
 * -------------------------------
 * Handles all endpoints related to Hosts.
 *
 * Endpoints:
 *  - POST /hosts/create       → Create a new host
 *  - GET /hosts               → Get all hosts (with optional filters)
 *  - GET /hosts/:id           → Get host details by _id or hostId
 */

const express = require("express");
const hostController = require("../controllers/host.controller");
const router = express.Router();

// Create Host
router.post("/create", hostController.createHost);

// Get all Hosts (optional filters: ?agencyId=xxx&status=active)
router.get("/", hostController.getAllHosts);

// Get Host details by ID (MongoDB _id or hostId)
router.get("/:id", hostController.getHostDetails);

// Get all requests (agencyId/hostId/status as query params)
router.get("/requests", hostController.getAllRequests);

// Customer sends request to agency
router.post("/request/from-customer", hostController.sendRequestFromCustomer);

// Agency accepts/rejects customer request
router.put(
  "/request/:requestId/agency-action",
  hostController.acceptOrRejectRequestByAgency
);

// Agency sends request to customer
router.post("/request/from-agency", hostController.sendRequestFromAgency);

// Customer accepts/rejects agency request
router.put(
  "/request/:requestId/customer-action",
  hostController.acceptOrRejectRequestByCustomer
);

module.exports = router;
