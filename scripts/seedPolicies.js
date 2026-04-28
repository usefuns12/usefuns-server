const mongoose = require("mongoose");
const Policy = require("../models/Policy");
require("dotenv").config();

async function seedPolicies() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL);
    console.log("✅ Connected to MongoDB");

    // 🔹 Host Salary Policy
    const hostSalaryPolicy = {
      type: "hostSalary",
      hostSalary: {
        minDays: 7,
        maxDays: 15,
        diamondTarget: 15000,
        hourSlabs: [
          { minHours: 15, percentage: 100 },
          { minHours: 12, percentage: 70 },
          { minHours: 5, percentage: 30 },
        ],
        vipFullSalaryOnTarget: true,
        reward: {
          enabled: true,
          frameDays: 15,
        },
      },
    };

    await Policy.findOneAndUpdate({ type: "hostSalary" }, hostSalaryPolicy, {
      upsert: true,
      new: true,
    });
    console.log("✅ Host Salary Policy seeded/updated");

    // 🔹 Agency Commission Policy
    const agencyCommissionPolicy = {
      type: "agencyCommission",
      agencyCommission: [
        { minTotalUcoins: 18000000, percentage: 21 },
        { minTotalUcoins: 9000000, percentage: 19 },
        { minTotalUcoins: 5300000, percentage: 15 },
        { minTotalUcoins: 3500000, percentage: 11 },
        { minTotalUcoins: 1500000, percentage: 8 },
        { minTotalUcoins: 100000, percentage: 6 },
      ],
    };

    await Policy.findOneAndUpdate(
      { type: "agencyCommission" },
      agencyCommissionPolicy,
      { upsert: true, new: true }
    );
    console.log("✅ Agency Commission Policy seeded/updated");

    console.log("\n🎉 All policies seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding policies:", error);
    process.exit(1);
  }
}

seedPolicies();
