const mongoose = require("mongoose");

const PolicySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["hostSalary", "agencyCommission"],
      required: true,
      unique: true,
    },

    // 🔹 Host Salary Rules
    hostSalary: {
      noDayLimits: {
        type: Boolean,
        default: false,
        description: "If true, minDays and maxDays restrictions are ignored",
      },
      minDays: Number,
      maxDays: Number,

      diamondTarget: Number,

      hourSlabs: [
        {
          minHours: Number,
          percentage: Number, // 100, 70, 30
        },
      ],

      vipFullSalaryOnTarget: {
        type: Boolean,
        default: true,
      },

      reward: {
        enabled: Boolean,
        frameDays: Number,
      },

      // 🔒 STEP 3: Unlock Rules (Fraud Protection)
      unlockRules: {
        lockDays: {
          type: Number,
          default: 3,
          description: "Days to keep salary locked before allowing withdrawal",
        },
        autoUnlock: {
          type: Boolean,
          default: true,
          description: "true = auto-unlock after lockDays, false = admin-only",
        },
      },
    },

    // 🔹 Agency Commission Rules
    agencyCommission: [
      {
        minTotalUcoins: Number,
        percentage: Number,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Policy", PolicySchema);
