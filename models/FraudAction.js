const mongoose = require("mongoose");

const FraudActionSchema = new mongoose.Schema(
  {
    // Type of fraud action
    type: {
      type: String,
      enum: [
        "gift_block", // Prevent gifting
        "wallet_freeze", // Prevent wallet operations
        "withdrawal_block", // Prevent withdrawals
        "host_suspend", // Prevent host activities (mic, stream)
        "device_ban", // Ban device from platform
      ],
      required: true,
      index: true,
    },

    // What entity is affected
    targetType: {
      type: String,
      enum: ["user", "host", "wallet", "device"],
      required: true,
      index: true,
    },

    // Reference to the affected entity (userId, hostId, walletId, or device fingerprint)
    targetRef: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Store device fingerprint if targetType is "device"
    deviceFingerprint: String,

    // Which alert triggered this action (for traceability)
    triggeredByAlert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alert",
      index: true,
    },

    // Human-readable reason
    reason: {
      type: String,
      required: true,
    },

    // Detailed metadata about the trigger
    triggerMetadata: {
      alertType: String, // e.g., "gift_velocity"
      alertCount: Number, // How many times triggered
      threshold: String, // What rule was broken
      evidenceUrls: [String], // Links to related alerts
    },

    // Action status
    status: {
      type: String,
      enum: ["active", "released", "expired", "converted_permanent"],
      default: "active",
      index: true,
    },

    // When does this action expire (if temporary)
    expiresAt: {
      type: Date,
      index: true,
    },

    // Duration in hours (for reference, e.g., 24 for 24-hour ban)
    durationHours: Number,

    // Who released this action
    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
    },

    // When was it released
    releasedAt: Date,

    // Reason for release
    releaseReason: String,

    // If extended, who extended it and when
    extendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
    },
    extendedAt: Date,
    extendedDurationHours: Number,
    extendNewExpiresAt: Date,
    extensionReason: String,

    // Audit trail (immutable history)
    auditTrail: [
      {
        action: {
          type: String,
          enum: [
            "created",
            "released",
            "extended",
            "converted_permanent",
            "expired",
            "deleted",
          ],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        actor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "customers",
        },
        actorRole: String, // "system" or "admin"
        reason: String,
        metadata: mongoose.Schema.Types.Mixed,
      },
    ],

    // Soft delete flag (no hard deletes ever)
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
    },
    deletionReason: String,

    // Notes from admins
    adminNotes: String,

    // Is this a manual admin-created action
    isManuallyCreated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    strict: true,
  },
);

// Index for finding active actions by target
FraudActionSchema.index({ targetType: 1, targetRef: 1, status: 1 });

// Index for finding actions by device
FraudActionSchema.index({ deviceFingerprint: 1, status: 1 });

// Index for audit queries
FraudActionSchema.index({ createdAt: -1, status: 1 });

// Virtual for checking if action is currently active
FraudActionSchema.virtual("isCurrentlyActive").get(function () {
  if (this.status === "active" && this.expiresAt) {
    return new Date() < this.expiresAt;
  }
  return this.status === "active" || this.status === "converted_permanent";
});

// Query helper for active actions
FraudActionSchema.query.active = function () {
  return this.find({
    status: { $in: ["active", "converted_permanent"] },
    isDeleted: false,
  });
};

// Query helper for a specific target
FraudActionSchema.query.forTarget = function (targetType, targetRef) {
  return this.find({
    targetType,
    targetRef,
    isDeleted: false,
  });
};

// Query helper for expired but not released
FraudActionSchema.query.expiredNotReleased = function () {
  return this.find({
    status: "active",
    expiresAt: { $lt: new Date() },
    isDeleted: false,
  });
};

// Method to release an action
FraudActionSchema.methods.release = async function (releaseData) {
  this.status = "released";
  this.releasedBy = releaseData.releasedBy;
  this.releasedAt = new Date();
  this.releaseReason = releaseData.reason;

  // Add to audit trail
  this.auditTrail.push({
    action: "released",
    timestamp: new Date(),
    actor: releaseData.releasedBy,
    actorRole: releaseData.actorRole || "admin",
    reason: releaseData.reason,
    metadata: { ip: releaseData.ip },
  });

  return this.save();
};

// Method to extend an action
FraudActionSchema.methods.extend = async function (extensionData) {
  if (this.status !== "active") {
    throw new Error("Cannot extend non-active fraud action");
  }

  const newExpiresAt = new Date(
    this.expiresAt.getTime() + extensionData.durationHours * 60 * 60 * 1000,
  );

  this.extendedBy = extensionData.extendedBy;
  this.extendedAt = new Date();
  this.extendedDurationHours = extensionData.durationHours;
  this.extendNewExpiresAt = newExpiresAt;
  this.extensionReason = extensionData.reason;
  this.expiresAt = newExpiresAt;

  // Add to audit trail
  this.auditTrail.push({
    action: "extended",
    timestamp: new Date(),
    actor: extensionData.extendedBy,
    actorRole: extensionData.actorRole || "admin",
    reason: extensionData.reason,
    metadata: { newExpiresAt },
  });

  return this.save();
};

// Method to convert to permanent
FraudActionSchema.methods.convertToPermanent = async function (conversionData) {
  if (this.status !== "active") {
    throw new Error("Cannot convert non-active fraud action to permanent");
  }

  this.status = "converted_permanent";
  this.expiresAt = null;
  this.extendedBy = conversionData.convertedBy;
  this.extendedAt = new Date();
  this.extensionReason = conversionData.reason;

  // Add to audit trail
  this.auditTrail.push({
    action: "converted_permanent",
    timestamp: new Date(),
    actor: conversionData.convertedBy,
    actorRole: conversionData.actorRole || "admin",
    reason: conversionData.reason,
    metadata: { justification: conversionData.justification },
  });

  return this.save();
};

// Method to expire (when expiration happens automatically)
FraudActionSchema.methods.markExpired = async function () {
  if (this.status === "active") {
    this.status = "expired";

    // Add to audit trail
    this.auditTrail.push({
      action: "expired",
      timestamp: new Date(),
      actor: null,
      actorRole: "system",
      reason: "Automatic expiration",
    });

    return this.save();
  }
};

// Prevent hard deletes
FraudActionSchema.methods.softDelete = async function (deleteData) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deleteData.deletedBy;
  this.deletionReason = deleteData.reason;

  // Add to audit trail
  this.auditTrail.push({
    action: "deleted",
    timestamp: new Date(),
    actor: deleteData.deletedBy,
    actorRole: deleteData.actorRole || "admin",
    reason: deleteData.reason,
  });

  return this.save();
};

module.exports = mongoose.model("FraudAction", FraudActionSchema);
