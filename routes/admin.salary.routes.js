const express = require("express");
const router = express.Router();
const adminSalaryController = require("../controllers/admin.salary.controller");
const adminActionsController = require("../controllers/admin.actions.controller");
const { userAuth } = require("../middlewares/auth");
const { requirePermission } = require("../middlewares/roleBasedAccess");

// All routes require user authentication
router.use(userAuth);

// Salary Cycles (Read-only)
router.get("/salary-cycles", adminSalaryController.getSalaryCycles);
router.get("/salary-cycles/stats", adminSalaryController.getSalaryCycleStats);
router.get("/salary-cycles/:id", adminSalaryController.getSalaryCycleById);

// Salary Cycle Actions (Admin interventions)
router.post(
  "/salary-cycles/:id/recalculate",
  adminActionsController.recalculateSalaryCycle
);
router.post("/salary-cycles/:id/hold", adminActionsController.holdSalaryCycle);
router.post(
  "/salary-cycles/:id/release",
  adminActionsController.releaseSalaryCycle
);
router.post(
  "/salary-cycles/:id/force-payout",
  adminActionsController.forcePayoutSalaryCycle
);
router.post(
  "/salary-cycles/:id/reverse",
  adminActionsController.reverseSalaryPayment
);

// Wallet Lock/Unlock Actions (STEP 3)
router.post("/transactions/:id/unlock", adminActionsController.unlockFunds);
router.post("/transactions/:id/relock", adminActionsController.relockFunds);
router.get(
  "/wallet-lock-status/:userId",
  adminActionsController.getWalletLockStatusAdmin
);

// Agency Commissions (Read-only)
router.get("/agency-commissions", adminSalaryController.getAgencyCommissions);
router.get(
  "/agency-commissions/stats",
  adminSalaryController.getAgencyCommissionStats
);
router.get(
  "/agency-commissions/:id",
  adminSalaryController.getAgencyCommissionById
);

module.exports = router;
