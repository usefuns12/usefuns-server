const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  resource: {
    type: String,
    required: true,
  },
  thumbnail: {
    type: String,
  },
  validTill: {
    type: Date,
  },
  isDefault: {
    type: Boolean,
    required: true,
  },
  isOfficial: {
    type: Boolean,
    required: true,
  },
});

const customerSchema = new mongoose.Schema(
  {
    // User Identification
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    isMysteryMen: {
      type: Boolean,
      default: false,
    },

    oldUserId: {
      type: String,
      default: null,
    },
    specialIdValidity: {
      type: Date,
      default: null,
    },
    specialIdItemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: "shopItem",
    },
    isSpecialId: {
      type: Boolean,
      default: false,
    },
    currentJoinedRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: "room",
    },
    // Status Flags (extended)
    isOnline: {
      type: Boolean,
      default: false,
    },
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
    },
    isHost: {
      type: Boolean,
      default: false,
    },
    hostRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Host",
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },
    userRole: {
      type: [String],
      enum: [
        "ufTeam",
        "agency",
        "seller",
        "manager",
        "countryAdmin",
        "admin",
        "subAdmin",
        "host",
        "merchant",
      ],
    },

    // Basic Info
    name: {
      type: String,
      required: true,
      trim: true,
    },
    countryCode: {
      type: String,
      required: true,
    },
    mobile: {
      type: Number,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
    },
    dob: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
    },
    language: {
      type: String,
    },
    bio: {
      type: String,
      default: null,
    },
    profileImage: {
      type: String,
      required: true,
    },

    // Social Connections
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],

    // Status Flags
    isCommentRestricted: {
      type: Boolean,
      required: true,
      default: false,
    },
    isActiveUser: {
      type: Boolean,
      default: true,
    },
    isActiveDevice: {
      type: Boolean,
      default: true,
    },

    // Gaming and Rewards
    diamonds: {
      type: Number,
      default: 0,
      min: 0,
      // non negative
      validate: {
        validator: (value) => Number.isInteger(value) && value >= 0,
        message: "{VALUE} must be a non-negative integer",
      },
    },

    purchasedDiamonds: {
      type: Number,
      default: 0,
    },
    beans: {
      type: Number,
      default: 0,
      min: 0,
      // non negative
      validate: {
        validator: (value) => Number.isInteger(value) && value >= 0,
        message: "{VALUE} must be a non-negative integer",
      },
    },
    likes: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 0,
    },
    xp: {
      type: String,
      default: "0",
    },
    usedDiamonds: {
      type: Number,
      default: 0,
    },

    // Device and Token Info
    deviceId: {
      type: String,
      default: null,
    },

    // Device Token Info
    deviceToken: {
      type: String,
      default: null,
    },
    token: {
      type: String,
    },

    onSeat: {
      type: Boolean,
      default: false,
    },

    // Other Collections and Features
    tags: [],
    vehicles: [userItemSchema],
    chatBubbles: [userItemSchema],
    lockRooms: [userItemSchema],
    extraSeats: [userItemSchema],
    frames: [userItemSchema],
    themes: [userItemSchema],
    relationships: [userItemSchema],
    recentlyJoinedRooms: [],
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: "room",
    },
    isLive: {
      type: Boolean,
      default: false,
    },

    // Commented Fields for Potential Future Use
    /* status: {
      type: String,
      default: "Approved",
    },
    official_id: {
      type: String,
    },
    coins: {
      type: Number,
      default: 0,
    },
    block_users: {
      type: Number,
    },
    accounts: {
      type: Number,
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "club",
    },
    agency: [],
    admin: [],
    subAdmin: [],
    special_id: [],
    */

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      default: null,
    },
    referrals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customers",
      },
    ],

    referralBeansEarned: {
      type: Number,
      default: 0,
    },

    referralBeansBalance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

customerSchema.set("toObject", { getters: true });
customerSchema.set("toJSON", { getters: true });

customerSchema.pre("save", async function (next) {
  // Hash the password before saving the user models
  if (this.isModified("pwd")) {
    this.pwd = await bcrypt.hash(this.pwd, 9);
  }
  next();
});

customerSchema.methods.generateAuthToken = async function () {
  // Generate an auth token for the user
  this.token = jwt.sign({ _id: this._id }, process.env.JWT_KEY);
  await this.save();
  return this.token;
};

customerSchema.statics.loginMobile = async function (mobile) {
  try {
    const customer = await this.findOne({
      mobile: mobile,
    });

    if (!customer) {
      throw new Error("Invalid credentials.");
    }

    if (!customer.isActiveUser) {
      throw new Error("Your account has been banned.");
    }

    return customer;
  } catch (error) {
    return Promise.reject(error);
  }
};

customerSchema.statics.loginEmail = async function (email) {
  try {
    const customer = await this.findOne({
      email: email,
    });

    if (!customer) {
      throw new Error("Invalid credentials.");
    }

    if (!customer.isActiveUser) {
      throw new Error("Your account has been banned.");
    }

    return customer;
  } catch (error) {
    return Promise.reject(error);
  }
};

customerSchema.statics.logingoogle = async function (google_id) {
  try {
    const user = await this.findOne({
      google_id,
    });
    if (!user) {
      throw new Error("Invalid credentials.");
    }
    if (!user.isActiveUser) {
      throw new Error("Your account has been deactivated.");
    }

    return user;
  } catch (error) {
    return Promise.reject(error);
  }
};

customerSchema.statics.changepassword = async function (email, oldpwd, newpwd) {
  const customer = await this.findOne({ email });
  if (!customer) {
    throw new Error("Invalid user.");
  }
  const isPasswordMatch = await bcrypt.compare(oldpwd, customer.pwd);
  if (!isPasswordMatch) {
    throw new Error("Invalid old password.");
  } else {
    customer = await this.findOneAndUpdate(
      { username },
      { pwd: await bcrypt.hash(newpwd, 9) },
      { new: true }
    );
  }

  return customer;
};

customerSchema.statics.resetpassword = async function (id, newpwd) {
  const customer = await this.findOneAndUpdate(
    { _id: id },
    { pwd: await bcrypt.hash(newpwd, 9) },
    { new: true }
  );
  if (!customer) {
    throw new Error("Invalid user.");
  }
  return customer;
};

module.exports = mongoose.model("customers", customerSchema);
