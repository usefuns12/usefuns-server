const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers", // linking to your customers collection
      required: true,
      unique: true,
    },
    name: {
      type: String,
    },
    countryCode: {
      type: String,
      required: true,
    },
    announcement: {
      type: String,
      default: null,
    },

    // Diamond Usage and Levels
    treasureBoxLevel: {
      type: Number,
      default: 0,
    },
    diamondsUsedToday: {
      type: Number,
      default: 0,
    },
    totalDiamondsUsed: {
      type: Number,
      default: 0,
    },
    diamondsUsedCurrentSeason: {
      type: Number,
      default: 0,
    },
    diamondsUsedLastSeason: {
      type: Number,
      default: 0,
    },

    // Members and Related Lists
    admin: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],
    activeUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],
    lastMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],
    blockedList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],
    groupMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],

    // ✅ New Fields
    chatUserBannedList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],
    seatLockedUserList: [{ type: Number }], // Array of seat numbers

    // Room Details
    roomImage: {
      type: String,
      required: true,
    },
    password: {
      type: String,
    },
    noOfSeats: {
      type: Number,
      default: 8,
    },
    language: {
      type: String,
      default: "English",
    },
    groupName: {
      type: String,
    },

    // Time Spent in Room
    lastHostJoinedAt: {
      type: Date,
      default: null,
    },
    hostingTimeCurrentSession: {
      type: Number,
      default: 0,
    },
    hostingTimeLastSession: {
      type: Number,
      default: 0,
    },

    // Room Status Flags
    isLocked: {
      type: Boolean,
      required: true,
      default: false,
    },
    isHost: {
      type: Boolean,
      required: true,
      default: false,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },

    kickHistory: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "customers",
          required: true,
        },
        kickedAt: { type: Date, required: true },
        expireAt: { type: Date, required: true },
      },
    ],
    mutedList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],

    // 🔹 Additional fields for integration with host/agency ranking system
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Host", // from Host schema
    },
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
    },
    visitorsCount: {
      type: Number,
      default: 0,
    },
    selfHostingCount: {
      type: Number,
      default: 0,
    },
    totalGifts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Useful indexes for performance
RoomSchema.index({ roomId: 1 });
RoomSchema.index({ ownerId: 1 });
RoomSchema.index({ agencyId: 1 });
RoomSchema.index({ hostId: 1 });
RoomSchema.index({ isActive: 1 });

module.exports = mongoose.model("room", RoomSchema);
