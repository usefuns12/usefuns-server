const express = require("express");
const router = express.Router();
const policyController = require("../controllers/policy.controller");
const { userAuth } = require("../middlewares/auth");
const { requirePermission } = require("../middlewares/roleBasedAccess");

// Policy Management Routes
router.post(
  "/salary",
  userAuth,
  requirePermission("manage_policies"),
  policyController.createHostSalaryPolicy
);
router.get(
  "/salary",
  userAuth,
  requirePermission("view_policies"),
  policyController.getAllPolicies
);
router.get(
  "/salary/stats",
  userAuth,
  requirePermission("view_policies"),
  policyController.getSalaryStats
);
router.get(
  "/salary/:id",
  userAuth,
  requirePermission("view_policies"),
  policyController.getAllPolicies
);
router.put(
  "/salary/:id",
  userAuth,
  requirePermission("manage_policies"),
  policyController.createHostSalaryPolicy
);
router.delete(
  "/salary/:id",
  userAuth,
  requirePermission("manage_policies"),
  policyController.createHostSalaryPolicy
);
router.post(
  "/salary/process-cycles",
  userAuth,
  requirePermission("manage_policies"),
  policyController.processSalaryCycles
);
router.post(
  "/salary/pay-all",
  userAuth,
  requirePermission("manage_policies"),
  policyController.payAllSalaries
);

// Commission Management Routes
router.post(
  "/commission",
  userAuth,
  requirePermission("manage_policies"),
  policyController.createAgencyCommissionPolicy
);
router.get(
  "/commission",
  userAuth,
  requirePermission("view_policies"),
  policyController.getAllPolicies
);
router.get(
  "/commission/stats",
  userAuth,
  requirePermission("view_policies"),
  policyController.getCommissionStats
);
router.get(
  "/commission/:id",
  userAuth,
  requirePermission("view_policies"),
  policyController.getAllPolicies
);
router.put(
  "/commission/:id",
  userAuth,
  requirePermission("manage_policies"),
  policyController.createAgencyCommissionPolicy
);
router.post(
  "/commission/calculate",
  userAuth,
  requirePermission("manage_policies"),
  policyController.calculateCommissions
);
router.post(
  "/commission/pay-all",
  userAuth,
  requirePermission("manage_policies"),
  policyController.payAllCommissions
);

module.exports = router;
