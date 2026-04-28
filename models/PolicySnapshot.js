/**
 * STEP 8.1: POLICY & LOGIC FREEZE
 *
 * All business logic policies must be frozen at launch
 * Future changes create new versions only
 * Current versions marked as LOCKED
 */

const mongoose = require("mongoose");

/**
 * Policy Snapshot Schema
 * Immutable snapshot of business logic at a point in time
 * Used for fraud rules, salary calculation, commission logic
 */
const PolicySnapshotSchema = new mongoose.Schema(
  {
    // Policy identification
    policyType: {
      type: String,
      enum: [
        "SALARY_CALCULATION",
        "COMMISSION_CALCULATION",
        "FRAUD_RULE",
        "WALLET_LOCK_RULE",
        "GIFT_RATE_LIMIT",
        "WITHDRAWAL_LIMIT",
      ],
      required: true,
    },

    // Version control
    version: {
      type: Number,
      required: true,
      index: true,
    },

    // Status (DRAFT → ACTIVE → LOCKED → DEPRECATED)
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "LOCKED", "DEPRECATED"],
      default: "DRAFT",
      index: true,
    },

    // The actual policy logic (immutable once set)
    definition: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Change log
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    activatedBy: mongoose.Schema.Types.ObjectId,
    activatedAt: Date,

    lockedBy: mongoose.Schema.Types.ObjectId,
    lockedAt: Date,

    deprecatedBy: mongoose.Schema.Types.ObjectId,
    deprecatedAt: Date,

    // Reason for changes
    changeReason: String,
    lockReason: String,
    deprecationReason: String,

    // Hash of definition (verify immutability)
    definitionHash: {
      type: String,
      required: true,
      index: true,
    },

    // Metadata
    description: String,
    tags: [String],
    references: [String], // Links to code or documentation

    // Audit trail
    changelog: [
      {
        action: String,
        by: mongoose.Schema.Types.ObjectId,
        at: Date,
        details: String,
      },
    ],
  },
  { timestamps: true }
);

// Prevent direct updates to locked policies
PolicySnapshotSchema.pre("updateOne", function (next) {
  if (this.getOptions().skipFreezeCheck) {
    return next();
  }

  const updateData = this.getUpdate();
  if (updateData.$set && updateData.$set.status === "LOCKED") {
    // Allow locking
    return next();
  }

  // Prevent any other updates to locked policies
  const filter = this.getFilter();
  PolicySnapshot.findOne(filter).then((doc) => {
    if (doc && doc.status === "LOCKED") {
      throw new Error(
        `Cannot modify locked policy "${doc.policyType}" v${doc.version}. Create a new version instead.`
      );
    }
    next();
  });
});

// Prevent direct deletion of locked policies
PolicySnapshotSchema.pre("deleteOne", function (next) {
  const filter = this.getFilter();
  PolicySnapshot.findOne(filter).then((doc) => {
    if (doc && (doc.status === "LOCKED" || doc.status === "ACTIVE")) {
      throw new Error(
        `Cannot delete active/locked policy "${doc.policyType}" v${doc.version}. Deprecate instead.`
      );
    }
    next();
  });
});

// Index for quick lookups
PolicySnapshotSchema.index({ policyType: 1, status: 1 });
PolicySnapshotSchema.index({ policyType: 1, version: -1 });

/**
 * Instance methods
 */

PolicySnapshotSchema.methods.lock = async function (lockingUserId, reason) {
  if (this.status === "LOCKED") {
    throw new Error("Policy already locked");
  }

  this.status = "LOCKED";
  this.lockedBy = lockingUserId;
  this.lockedAt = new Date();
  this.lockReason = reason;

  this.changelog.push({
    action: "LOCKED",
    by: lockingUserId,
    at: new Date(),
    details: reason,
  });

  return this.save();
};

PolicySnapshotSchema.methods.deprecate = async function (
  deprecatingUserId,
  reason
) {
  if (this.status === "LOCKED") {
    throw new Error("Cannot deprecate locked policy, must create new version");
  }

  this.status = "DEPRECATED";
  this.deprecatedBy = deprecatingUserId;
  this.deprecatedAt = new Date();
  this.deprecationReason = reason;

  this.changelog.push({
    action: "DEPRECATED",
    by: deprecatingUserId,
    at: new Date(),
    details: reason,
  });

  return this.save();
};

PolicySnapshotSchema.methods.activate = async function (activatingUserId) {
  if (this.status !== "DRAFT") {
    throw new Error("Only DRAFT policies can be activated");
  }

  // Deactivate previous version if exists
  await PolicySnapshot.updateMany(
    {
      policyType: this.policyType,
      status: "ACTIVE",
    },
    {
      $set: { status: "DEPRECATED", deprecatedAt: new Date() },
      $push: {
        changelog: {
          action: "AUTO_DEPRECATED",
          by: activatingUserId,
          at: new Date(),
          details: `Replaced by v${this.version}`,
        },
      },
    }
  );

  this.status = "ACTIVE";
  this.activatedBy = activatingUserId;
  this.activatedAt = new Date();

  this.changelog.push({
    action: "ACTIVATED",
    by: activatingUserId,
    at: new Date(),
  });

  return this.save();
};

/**
 * Static methods
 */

PolicySnapshotSchema.statics.getActivePolicy = async function (policyType) {
  return this.findOne({
    policyType,
    status: "ACTIVE",
  });
};

PolicySnapshotSchema.statics.createNewVersion = async function (
  policyType,
  definition,
  createdBy,
  reason
) {
  const crypto = require("crypto");

  // Get latest version
  const latest = await this.findOne({ policyType }).sort({ version: -1 });
  const nextVersion = (latest?.version || 0) + 1;

  // Hash the definition for integrity checking
  const definitionHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(definition))
    .digest("hex");

  const policy = new this({
    policyType,
    version: nextVersion,
    definition,
    definitionHash,
    createdBy,
    changeReason: reason,
    status: "DRAFT",
    changelog: [
      {
        action: "CREATED",
        by: createdBy,
        at: new Date(),
        details: reason,
      },
    ],
  });

  return policy.save();
};

PolicySnapshotSchema.statics.getVersionHistory = async function (policyType) {
  return this.find({ policyType })
    .sort({ version: -1 })
    .select("version status activatedAt lockedAt deprecatedAt changeReason");
};

const PolicySnapshot = mongoose.model("PolicySnapshot", PolicySnapshotSchema);

module.exports = PolicySnapshot;
