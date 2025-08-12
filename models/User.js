const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    username: { type: String, unique: true, sparse: true },
    passwordHash: String,
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    roleRef: { type: mongoose.Schema.Types.ObjectId }, // link to Agency, Seller, etc.
    country: String,
    profile: {
      avatarUrl: String,
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

UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ role: 1 });

module.exports = mongoose.model("User", UserSchema);
