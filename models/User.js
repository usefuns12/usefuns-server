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

    // Agency ownership (for Admin and SubAdmin only)
    ownedAgencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Agency",
      },
    ],

    // Children users created by this user
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Parents users of this user
    parents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // App-level fields (not present in Customer)
    passwordHash: String,

    // Country assignment for geographic hierarchy
    country: {
      type: String,
      required: function () {
        return this.role && this.role.name !== "CountryManager";
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
