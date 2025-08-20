/**
 * User Routes
 * -------------------------------
 * Handles all endpoints related to application users.
 *
 * Endpoints:
 *  - POST /users/create       → Create a new user (linked to Customer)
 *    If role = Host → also creates a Host entry
 *
 * Middleware:
 *  - You can add auth middlewares later (e.g. only Admin/Agency can create users)
 */

const express = require("express");
const userController = require("../controllers/userController");
const middleware = require("../middlewares");

const router = express.Router();

// Create a new User
router.route("/create").post(
  // Example: restrict to admins/agency if needed
  // middleware.auth.authAdmin,
  userController.createUser
);

module.exports = router;
