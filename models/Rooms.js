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
    seatLockedUserList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],

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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("room", RoomSchema);
