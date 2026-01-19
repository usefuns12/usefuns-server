/**
 * User Routes
 * -------------------------------
 * Handles all endpoints related to application users.
 *
 * Endpoints:
 *  - POST   /users/create       → Create a new user (linked to Customer)
 *  - GET    /users/:id          → Get user details by ID
 *  - PUT    /users/:id          → Update user details
 *  - DELETE /users/:id          → Delete user
 *  - GET    /users              → List all users (with optional filters)
 *
 * Middleware:
 *  - You can add auth middlewares later (e.g. only Admin/Agency can manage users)
 */

const express = require("express");
const userController = require("../controllers/user.controller");
const middleware = require("../middlewares");
const { userAuth } = require("../middlewares/auth");

const router = express.Router();

// ✅ Get all users (with optional filters: role, status, agencyId etc.)
router.get(
  "/get-all",
  // middleware.auth.authAdmin,
  userController.getAllUsersByRole
);

router.get(
  "/get-by-role-and-parent",
  userAuth,
  userController.getAllUsersByRoleAndParentId
);

// ✅ Get all Country Admins by countryManagerId
router.get(
  "/get-country-admins",
  // middleware.auth.authAdmin,
  userController.getAllCountryAdminsByManager
);

// ✅ Get all Admins by countryAdminId
router.get(
  "/get-admins-by-country-admin",
  // middleware.auth.authAdmin,
  userController.getAllAdminsByCountryAdmin
);

// ✅ Create a new User
router.post(
  "/create",
  // Example: restrict to admins/agency if needed
  // middleware.auth.authAdmin,
  userController.createUser
);

// ✅ Get user details by ID
router.get("/getUserDetails/:id", userController.getUserDetails);

// ✅ Get user details by token
router.get(
  "/getUserDetailsByToken",
  userAuth,
  userController.getUserDetailsByToken
);

// ✅ Update user details
router.put(
  "/:id",
  // middleware.auth.authAdmin,
  userController.updateUser
);

// ✅ Delete user
router.delete(
  "/:id",
  // middleware.auth.authAdmin,
  userController.deleteUser
);

// ✅ Get all Admin Review Requests
router.get(
  "/admin-review-requests",
  middleware.auth.userAuth,
  userController.getAllAdminReviewRequests
);

// ✅ Accept Admin Review Request
router.post(
  "/admin-review-requests/:requestId/accept",
  // middleware.auth.authAdmin,
  userController.acceptAdminReviewRequest
);

module.exports = router;
