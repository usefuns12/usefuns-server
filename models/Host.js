const mongoose = require("mongoose");

const HostSchema = new mongoose.Schema(
  {
    // 🔹 Link Host with existing Customer collection
    customerRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      required: true, // enforce relation
    },
    hostId: { type: Number, required: true, unique: true },
    displayName: String,
    joinDate: Date,
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency" },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    totalHostTimeHours: { type: Number, default: 0 },
    giftsReceivedTotal: { type: Number, default: 0 },
    dailyStats: [
      {
        date: Date,
        hostTimeHours: Number,
        gifts: Number,
        visitors: Number,
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive", "left"],
      default: "active",
    },

    // App-level fields (not present in Customer)
    passwordHash: String,
  },
  { timestamps: true }
);

HostSchema.index({ agencyId: 1 });
HostSchema.index({ hostId: 1 });

// ✅ Auto-populate middleware for customerRef
function autoPopulateCustomerRef(next) {
  this.populate("customerRef");
  next();
}

HostSchema.pre("find", autoPopulateCustomerRef);
HostSchema.pre("findOne", autoPopulateCustomerRef);
HostSchema.pre("findOneAndUpdate", autoPopulateCustomerRef);
HostSchema.pre("findById", autoPopulateCustomerRef);

module.exports = mongoose.model("Host", HostSchema);
