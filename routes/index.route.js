const adminRoutes = require("./admin.router");
const customerRoutes = require("./customer.router");
const roomGameRoutes = require("./roomGame.router");
const gameServerRoutes = require("./gameServer.router");
const clubRoutes = require("./club.router");
const appVRoutes = require("./appV.router");
const roomRoutes = require("./room.router");
const shopRoutes = require("./shop.router");
const diamondValueRoutes = require("./diamondValue.router");
const carouselRoutes = require("./carousel.router");
const giftRoutes = require("./gift.router");
const paymentRoutes = require("./payment.router");
const apiConfigRoutes = require("./apiConfig.router");
const quantityCashbackRoutes = require("./quantityCashback.route");
const roleRoutes = require("./role.router");
const userRoutes = require("./user.router");
const agencyRoutes = require("./agency.router");
const hostRoutes = require("./host.router");
const userAuthRoutes = require("./auth.router");
const notificationRoutes = require("./notification.router");
const treasureboxRoutes = require("./treasurebox.router");

// Additional routes
// const adminSalaryRoutes = require("./admin.salary.routes");
// const disputeRoutes = require("./dispute.routes");
// const alertRoutes = require("./alert.routes");
// const kpiRoutes = require("./kpi.routes");
// const fraudRoutes = require("./fraud.routes");
// const queueRoutes = require("./queue.routes");
// const policyRoutes = require("./policy.routes");

const express = require("express");
const router = express.Router();

/** GET /health-check - Check service health */
router.get("/health-check", (req, res) => res.send("OK"));

// API v1 routes
router.use("/admin", adminRoutes);
router.use("/user", customerRoutes);
router.use("/roomGame", roomGameRoutes);
router.use("/carousel", carouselRoutes);
//router.use('/club', clubRoutes);
router.use("/app", appVRoutes);
router.use("/room", roomRoutes);
router.use("/shop", shopRoutes);
router.use("/gift", giftRoutes);
router.use("/payment", paymentRoutes);
router.use("/diamondValue", diamondValueRoutes);
router.use("/apiConfig", apiConfigRoutes);
router.use("/quantity", quantityCashbackRoutes);
router.use("/roles", roleRoutes);
router.use("/users", userRoutes);
router.use("/agencies", agencyRoutes);
router.use("/hosts", hostRoutes);
router.use("/auth", userAuthRoutes);
router.use("/notifications", notificationRoutes);
router.use("/treasurebox", treasureboxRoutes);

// Additional feature routes
// router.use("/admin/salary", adminSalaryRoutes);
// router.use("/disputes", disputeRoutes);
// router.use("/admin/disputes", disputeRoutes);
// router.use("/admin/alerts", alertRoutes);
// router.use("/admin/kpi", kpiRoutes);
// router.use("/admin/fraud", fraudRoutes);
// router.use("/admin/queues", queueRoutes);
// router.use("/admin/policies", policyRoutes);

module.exports = router;
