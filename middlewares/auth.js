const jwt = require("jsonwebtoken");
const models = require("../models");
const { verifyToken } = require("../utils/jwt");
const logger = require("../classes").Logger(__filename);

const authCustomer = async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    // decode the token //
    try {
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.JWT_KEY, async (error, decoded) => {
        if (error) {
          res.status(401).json({
            success: false,
            message: "Not Authorized To Access This Route",
          });
          return;
        }

        const customer = await models.Customer.findOne({
          _id: decoded._id,
          token: token,
        });

        if (!customer) {
          res.status(401).json({
            success: false,
            message: "Not Authorized To Access This Route",
          });
        }

        req.customer = customer;
        req.token = token;
        next();
      });
    } catch (err) {
      logger.error("Token Error --->", err);
      res.status(401).json({
        success: false,
        message: "Not Authorized To Access This Route",
      });
    }
  } else {
    res.status(401).json({
      success: false,
      message: "Not Authorized To Access This Route",
    });
  }
};

const authAdmin = async (req, res, next, isUserAuth) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    // decode the token //
    try {
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.JWT_KEY, async (error, decoded) => {
        if (error) {
          if (isUserAuth) {
            next(error);
            return;
          }

          res.status(401).json({
            success: false,
            message: "Not Authorized To Access This Route",
          });
          return;
        }

        if (decoded?.role.includes("master")) {
          req.user = decoded;
          next();
        } else {
          if (isUserAuth) {
            const err = new Error("Not Authorized To Access This Route");
            err.status = 401;
            next(err);
            return;
          }

          res.status(401).json({
            success: false,
            message: "Not Authorized To Access This Route",
          });
        }
      });
    } catch (err) {
      logger.error("Token Error --->", err);
      res.status(401).json({
        success: false,
        message: "Not Authorized To Access This Route",
      });
    }
  } else {
    res.status(401).json({
      success: false,
      message: "Not Authorized To Access This Route",
    });
  }
};

// 🔹 Basic authentication middleware
const userAuth = async (req, res, next) => {
  // Try authAdmin first
  authAdmin(
    req,
    res,
    (err) => {
      if (!err) {
        // authAdmin succeeded, user is master admin
        return next();
      }

      // authAdmin failed, proceed with normal user authentication
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res
          .status(401)
          .json({ success: false, message: "No token provided" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid or expired token" });
      }

      models.User.findById(decoded.id)
        .populate("role")
        .populate("customerRef")
        .then((user) => {
          if (!user || !user.isActive) {
            return res
              .status(401)
              .json({ success: false, message: "User not found or inactive" });
          }

          req.user = user;
          next();
        })
        .catch((error) => {
          console.error("Auth middleware error:", error);
          res.status(500).json({ success: false, message: error.message });
        });
    },
    true
  );
};

// 🔹 Role-based access middleware
const userAuthorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const userRoleName = req.user.role.name;
    if (!roles.includes(userRoleName)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    next();
  };
};

module.exports = { authCustomer, authAdmin, userAuth, userAuthorize };
