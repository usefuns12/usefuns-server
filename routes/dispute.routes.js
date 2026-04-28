const express = require("express");
const router = express.Router();
const disputeController = require("../controllers/dispute.controller");
const { userAuth } = require("../middlewares/auth");
const { requirePermission } = require("../middlewares/roleBasedAccess");

/**
 * 📋 USER ROUTES
 */
router.use(userAuth);

// Raise new dispute
router.post("/", disputeController.raiseDispute);

// Get my disputes
router.get("/my", disputeController.getMyDisputes);

// Get dispute details
router.get("/:id", disputeController.getDisputeDetails);

/**
 * 👨‍⚖️ ADMIN ROUTES
 */
router.use(requirePermission("manage_disputes"));

// List all disputes (admin)
router.get("/", disputeController.listDisputesAdmin);

// Get dispute details (admin)
router.get("/:id", disputeController.getDisputeDetails);

// Review dispute
router.post("/:id/review", disputeController.reviewDispute);

// Simulate recalculation
router.post("/:id/recalculate", disputeController.simulateRecalculationAdmin);

// Resolve with recalculation
router.put("/:id/resolution", disputeController.resolveWithRecalculation);

// Reject dispute
router.post("/:id/reject", disputeController.rejectDispute);

// Approve adjustment
router.patch("/:id/approve", disputeController.approveDisputeAdjustment);

module.exports = router;
