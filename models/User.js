const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    // 🔹 Link User with existing Customer collection
    customerRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      required: true, // enforce relation
    },

    // Role system
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    roleRef: { type: mongoose.Schema.Types.ObjectId }, // link to Agency, Seller, etc.

    // App-level fields (not present in Customer)
    passwordHash: String,
    country: String,

    profile: {
      pan: {
        name: String,
        number: String,
        photoUrl: String,
        verified: { type: Boolean, default: false },
      },
      kycStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ✅ Indexes
UserSchema.index({ customerRef: 1 });
UserSchema.index({ role: 1 });

// ✅ Auto-populate middleware for customerRef
function autoPopulateCustomerRef(next) {
  this.populate("customerRef");
  next();
}

UserSchema.pre("find", autoPopulateCustomerRef);
UserSchema.pre("findOne", autoPopulateCustomerRef);
UserSchema.pre("findOneAndUpdate", autoPopulateCustomerRef);
UserSchema.pre("findById", autoPopulateCustomerRef);

module.exports = mongoose.model("User", UserSchema);
