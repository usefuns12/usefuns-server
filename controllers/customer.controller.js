const axios = require("axios");
const models = require("../models");
//const redisClient = require('../config').redis;
const logger = require("../classes").Logger(__filename);
const mongoose = require("mongoose");
const constants = require("../utils/constants.json");
const moment = require("moment");
const { cleanupS3Files } = require("../utils/s3FileManager");

const login = async (req, res) => {
  try {
    const { email, mobile, deviceId } = req.body;

    if (deviceId) {
      const isBanned = await models.BannedDevice.findOne({ deviceId });
      if (isBanned) {
        return res.status(200).json({
          success: true,
          message: "Your device has been banned.",
        });
      }
    }

    let customer;
    if (mobile) {
      customer = await models.Customer.loginMobile(mobile);
    } else {
      customer = await models.Customer.loginEmail(email);
    }

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Login failed! Check authentication credentials",
      });
    }

    const token = await customer.generateAuthToken();
    const response = {
      _id: customer._id,
      userId: customer.userId,
      name: customer.name,
      ...(customer.mobile && { mobile: customer.mobile }),
      ...(customer.email && { email: customer.email }),
      dob: customer.dob,
      gender: customer.gender,
      language: customer.language,
      bio: customer.bio,
      followers: customer.followers,
      following: customer.following,
      google_id: customer.google_id,
      image_url: customer.image_url,
      token: token,
      countryCode: customer.countryCode,
    };

    res
      .status(200)
      .json({ success: true, message: "Login successful.", data: response });
  } catch (error) {
    console.log(error);
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const register = async (req, res) => {
  try {
    const {
      name,
      mobile,
      email,
      dob,
      gender,
      language,
      countryCode,
      deviceId,
    } = req.body;
    //const registerBonus = JSON.parse(await redisClient.get('registerBonus'));

    if (deviceId) {
      const isBanned = await models.BannedDevice.findOne({ deviceId });
      if (isBanned) {
        return res.status(200).json({
          success: true,
          message: "Your device has been banned.",
        });
      }
    }

    if (!mobile && !email) {
      return res.status(400).json({
        success: false,
        message: "Please provide either mobile or email.",
      });
    }

    const registerBonus = {};
    registerBonus.frame = constants.defaultShopItems.frame;
    registerBonus.theme = constants.defaultShopItems.theme;
    registerBonus.chatBubble = constants.defaultShopItems.chatBubble;
    const validTill = moment().add(3, "days").toISOString();
    registerBonus.frame.validTill = validTill;
    registerBonus.theme.validTill = validTill;
    registerBonus.chatBubble.validTill = validTill;

    let customerData = {
      name,
      dob,
      gender,
      countryCode,
      diamonds: 0,
      language,
      profileImage: req.body.image ? req.body.image : null,
      frames: [registerBonus.frame],
      themes: [registerBonus.theme],
      chatBubbles: [registerBonus.chatBubble],
      deviceId,
    };

    if (mobile) {
      const ismobile = await models.Customer.findOne({ mobile: mobile });
      if (ismobile) {
        return res.status(400).json({
          success: false,
          message: "Mobile already exists.",
        });
      }

      customerData.mobile = mobile;
    } else {
      const isEmail = await models.Customer.findOne({ email: email });
      if (isEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already exists.",
        });
      }

      customerData.email = email;
    }

    let lastUser = await models.Customer.findOne({}, "userId").sort({
      _id: -1,
    });
    let lastUserId = lastUser?.userId || "9999";

    const getUserId = async (userId) => {
      // Get all specialId arrays from items in the DB and flatten them
      const items = await models.ShopItem.find(
        { itemType: "specialId" },
        { specialId: 1, _id: 0 }
      );

      // Flatten all specialId arrays into one
      const specialIdsInUse = new Set(
        items.flatMap((item) => item.specialId || []).map((id) => parseInt(id))
      );

      let newUserId = parseInt(userId) + 1;

      // Loop until a unique ID is found
      while (specialIdsInUse.has(newUserId)) {
        ++newUserId;
      }

      return newUserId.toString();
    };

    customerData.userId = await getUserId(lastUserId);

    const customer = await models.Customer.create(customerData);

    const token = await customer.generateAuthToken();
    const response = {
      _id: customer._id,
      userId: customer.userId,
      name: customer.name,
      ...(customer.mobile && { mobile: customer.mobile }),
      ...(customer.email && { email: customer.email }),
      dob: customer.dob,
      gender: customer.gender,
      language: customer.language,
      followers: customer.followers,
      following: customer.following,
      bio: customer.bio,
      diamonds: customer.diamonds,
      coins: customer.coins,
      beans: customer.beans,
      profileImage: customer.profileImage,
      token: token,
    };

    res.status(200).json({
      success: true,
      message: "User registered successfully.",
      data: response,
    });
  } catch (error) {
    logger.error(error);
    console.error(error);
    res.status(400).json({ success: false, message: error.message });
    if (req.body.image) {
      cleanupS3Files(req.body.image);
    }
  }
};

const getPagination = async (req, res) => {
  // Pagination parameters
  const page = parseInt(req.query.page) || 1; // Default page 1
  const limit = parseInt(req.query.limit) || 100; // Default limit 10
  const skip = (page - 1) * limit;

  try {
    const [totalUsers, customers] = await Promise.all([
      models.Customer.countDocuments(),
      models.Customer.find(
        {},
        {
          userId: 1,
          name: 1,
          gender: 1,
          diamonds: 1,
          beans: 1,
          userRole: 1,
          isActiveUser: 1,
          isActiveDevice: 1,
        }
      )
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    if (customers?.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No customers found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Find successful.",
      data: customers,
      meta: {
        totalUsers,
        currentPage: page,
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getCustomers = async (req, res) => {
  try {
    const customers = await models.Customer.find();

    const customerData = customers.map((customer) => ({
      _id: customer._id,
      userId: customer.userId,
      name: customer.name,
      mobile: customer.mobile,
      images: customer.images,
      diamonds: customer.diamonds,
      is_active_userId: customer.is_active_userId,
    }));

    res
      .status(200)
      .json({ success: true, message: "Find successful.", data: customerData });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getCustomersById = async (req, res) => {
  const id = req.params.id;
  let customer;

  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      customer = await models.Customer.findOne({ _id: id })
        .populate({
          path: "roomId",
          select:
            "roomId name announcement roomImage hostingTimeCurrentSession",
        })
        .lean();
    } else {
      customer = await models.Customer.findOne({ userId: id })
        .populate({
          path: "roomId",
          select:
            "roomId name announcement roomImage hostingTimeCurrentSession",
        })
        .lean();
    }

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    if (customer.roomId) {
      customer.roomDetails = customer.roomId;
      delete customer.roomId;
    }

    res
      .status(200)
      .json({ success: true, message: "Find successful.", data: customer });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getViewCount = async (req, res) => {
  try {
    const id = req.params.id;

    const userData = await models.Customer.findOneAndUpdate(
      { _id: id },
      {
        $inc: { views: 1 },
      },
      { new: true }
    );

    if (!userData) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    io.to(id).emit("userDataUpdate", userData);
    res.status(200).json({ success: true, message: "Find successful." });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getByMultipleId = async (req, res) => {
  const { userId } = req.body;
  const pipe = [];

  if (userId && userId.trim()) {
    pipe.push({
      $match: {
        userId: { $regex: userId.trim(), $options: "i" },
      },
    });
  }

  try {
    const users = pipe.length > 0 ? await Customer.aggregate(pipe) : [];

    if (!users || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    res
      .status(200)
      .json({ success: true, message: "Find successful.", data: users });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getOtp = async (req, res) => {
  const { mobile } = req.body;
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  try {
    await models.Customer.findOneAndUpdate(
      { mobile: mobile },
      {
        $set: {
          loginOtp: otp,
        },
      }
    );

    const url =
      "https://rcsoft.in/api.php?appkey=9a2623e2-9d64-4fe5-8c3b-d514c11dd8e3&" +
      "authkey=E7DtJ1qZZtXcdlD5QmI2lSZ0B1HCniD50AfS1q05rQPjiVvEhR&" +
      `to=${mobile}&` +
      `message=Your OTP for USEFUNS login is: ${otp}. This OTP will expire in 5 minutes. Do not share your OTP with others.`;

    const response = await axios.get(url);
    if (response.data.message_status === "Success") {
      res
        .status(200)
        .json({ success: true, message: "OTP sent", data: { otp: otp } });
    } else {
      res.status(400).json({ success: false, message: "OTP sent failure." });
      logger.error(JSON.stringify(response.data));
    }
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateCustomer = async (req, res) => {
  const id = req.params.id;
  const userParams = req.body;

  if (req.body.image) {
    userParams.profileImage = req.body.image;
  }

  try {
    const userData = await models.Customer.findOneAndUpdate(
      { _id: id },
      { $set: userParams },
      { new: true }
    );

    if (!userData) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    io.to(id).emit("userDataUpdate", userData);
    res.status(200).json({ success: true, message: "Updated successfully." });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateMobileEmail = async (req, res) => {
  const id = req.params.id;
  const { type, value } = req.body;
  const updateField = type === 0 ? "mobile" : type === 1 ? "email" : null;

  if (!updateField) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid type specified." });
  }

  try {
    const user = await models.Customer.findOne({ _id: id });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "user not found",
      });
    }

    const existingUserField = await models.Customer.findOne({
      [updateField]: value,
    });

    if (existingUserField) {
      return res
        .status(400)
        .json({ success: false, message: `${updateField} already exists.` });
    }

    user[updateField] = value;
    const userData = await user.save();

    io.to(id).emit("userDataUpdate", userData);
    res.status(200).json({ success: true, message: "Updated successfully." });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const setDefaultItem = async (req, res) => {
  const { itemId, userId, type } = req.body;

  try {
    // Reusable function to update default item
    const updateDefaultItem = async (typeField) => {
      await models.Customer.updateOne(
        { _id: userId, [`${typeField}.isDefault`]: true },
        { $set: { [`${typeField}.$.isDefault`]: false } }
      );

      const userData = await models.Customer.findOneAndUpdate(
        { _id: userId, [`${typeField}._id`]: itemId },
        { $set: { [`${typeField}.$.isDefault`]: true } },
        { new: true }
      );

      return userData;
    };

    let userData;
    if (type === "frame") {
      userData = await updateDefaultItem("frames");
    } else if (type === "chatBubble") {
      userData = await updateDefaultItem("chatBubbles");
    } else if (type === "vehicle") {
      userData = await updateDefaultItem("vehicles");
    } else if (type === "theme") {
      userData = await updateDefaultItem("themes");
    }

    if (!userData) {
      return res
        .status(400)
        .json({ success: false, message: "User not found." });
    }

    io.to(userId).emit("userDataUpdate", userData);
    res.status(200).json({
      success: true,
      message: `${type} updated successfully.`,
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const followUser = async (req, res) => {
  const { from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      message: "Please provide both userId and following userId.",
    });
  }

  try {
    const users = await models.Customer.find({ _id: { $in: [from, to] } });

    // Check if both users were found
    if (users.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "One or both users not found.",
      });
    }

    // Determine which user is initiating and which is the target
    const user = users.find((u) => u._id.toString() === from);

    // Determine if 'from' user is already following 'to' user
    const isFollowing = user.following.includes(to);
    const updateAction = isFollowing ? "$pull" : "$push";
    const message = isFollowing ? "Unfollow successful." : "Follow successful.";

    // Update the 'following' list of the initiating user
    const updatedUser = await models.Customer.findOneAndUpdate(
      { _id: from },
      { [updateAction]: { following: to } },
      { new: true }
    );

    // Update the 'followers' list of the following user
    const updatedFollowingUser = await models.Customer.findOneAndUpdate(
      { _id: to },
      { [updateAction]: { followers: from } },
      { new: true }
    );

    io.to(from).emit("userDataUpdate", updatedUser);
    io.to(to).emit("userDataUpdate", updatedFollowingUser);

    res.status(200).json({ success: true, message });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const logout = async (req, res) => {
  const id = req.params.id;

  try {
    const user = await models.Customer.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          tokens: null,
        },
      }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "user not found",
      });
    }

    res.status(200).json({ success: true, message: "Logout successful." });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const addPost = async (req, res) => {
  const { createdBy, caption } = req.body;

  if (!createdBy) {
    return res.status(200).json({
      success: false,
      message: "please provide userId",
    });
  }

  try {
    const users = await models.Customer.findOne({ _id: createdBy });
    if (!users) {
      return res.status(400).json({
        success: false,
        message: `invalid userId`,
      });
    }

    const image = req.body.image ? req.body.image : null;
    const postData = await models.Posts.create({
      createdBy: createdBy,
      image,
      caption: caption,
    });

    res.status(200).json({
      success: true,
      message: "Post created successfully.",
      data: postData,
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
    if (req.body.image) {
      cleanupS3Files(req.body.image);
    }
  }
};

const getAllPosts = async (req, res) => {
  try {
    const posts = await models.Posts.aggregate([
      {
        $match: {},
      },
      // Join with customers to get post creator details
      {
        $lookup: {
          from: "customers",
          foreignField: "_id",
          localField: "createdBy",
          as: "userDetails",
        },
      },
      // Join with comments and their respective user details
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "postId",
          as: "comments",
        },
      },
      {
        $unwind: {
          path: "$comments",
          preserveNullAndEmptyArrays: true, // Allow posts with no comments
        },
      },
      {
        $lookup: {
          from: "customers",
          foreignField: "_id",
          localField: "comments.userId",
          as: "comments.userDetails",
        },
      },
      {
        $unwind: {
          path: "$comments.userDetails",
          preserveNullAndEmptyArrays: true, // Handle cases where no user found
        },
      },
      {
        $group: {
          _id: "$_id", // Re-group posts back together after unwind
          postDetails: { $first: "$$ROOT" }, // Get post details for each post
          comments: { $push: "$comments" }, // Aggregate all comments
        },
      },
      // Join with likes and their respective user details
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "postId",
          as: "likes",
        },
      },
      {
        $unwind: {
          path: "$likes",
          preserveNullAndEmptyArrays: true, // Allow posts with no likes
        },
      },
      {
        $lookup: {
          from: "customers",
          foreignField: "_id",
          localField: "likes.userId",
          as: "likes.userDetails",
        },
      },
      {
        $unwind: {
          path: "$likes.userDetails",
          preserveNullAndEmptyArrays: true, // Handle cases where no user found
        },
      },
      {
        $group: {
          _id: "$_id",
          postDetails: { $first: "$postDetails" }, // Re-group post details
          comments: { $first: "$comments" }, // Group comments back
          likes: { $push: "$likes" }, // Group likes back
        },
      },
      {
        $project: {
          "postDetails.commented": 0,
          "postDetails.like": 0,
        },
      },
    ]);

    return res
      .status(200)
      .json({ success: true, message: "User post details", data: posts });
  } catch (error) {
    logger.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getPostsPagination = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const pipeline = [
      {
        $match: {},
      },
      {
        $lookup: {
          from: "comments",
          foreignField: "postId",
          localField: "_id",
          as: "comments",
        },
      },
      {
        $lookup: {
          from: "customers",
          foreignField: "_id",
          localField: "comments.userId",
          as: "commented.userDetails",
        },
      },
      {
        $lookup: {
          from: "likes",
          foreignField: "postId",
          localField: "_id",
          as: "likes",
        },
      },
      {
        $lookup: {
          from: "customers",
          foreignField: "_id",
          localField: "likes.userId",
          as: "like.userDetails",
        },
      },
      {
        $project: {
          commented: 0,
          like: 0,
        },
      },
      {
        $sort: { createdAt: -1 }, // Sort by createdAt field in descending order (latest first)
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ];

    const posts = await models.Posts.aggregate(pipeline).limit(20);
    return res
      .status(200)
      .json({ success: true, message: `user post details`, data: posts });
  } catch (error) {
    logger.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getPostsByUserId = async (req, res) => {
  const { createdBy } = req.params;
  const page = parseInt(req.query.page) || 1;
  const PAGE_SIZE = 20;
  const skip = (page - 1) * PAGE_SIZE;

  try {
    const aggregationPipeline = [
      {
        $match: {
          createdBy: mongoose.Types.ObjectId.createFromHexString(createdBy),
        },
      },
      {
        $lookup: {
          from: "comments",
          foreignField: "postId",
          localField: "_id",
          as: "comments",
        },
      },
      {
        $lookup: {
          from: "customers",
          foreignField: "_id",
          localField: "comments.userId",
          as: "commented.userDetails",
        },
      },
      {
        $lookup: {
          from: "likes",
          foreignField: "postId",
          localField: "_id",
          as: "likes",
        },
      },
      {
        $lookup: {
          from: "customers",
          foreignField: "_id",
          localField: "likes.userId",
          as: "like.userDetails",
        },
      },
      {
        $project: {
          commented: 0,
          like: 0,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: PAGE_SIZE,
      },
    ];

    const posts = await models.Posts.aggregate(aggregationPipeline);

    return res.status(200).json({
      success: true,
      message: `User post details for page ${page}`,
      data: posts,
    });
  } catch (error) {
    logger.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const deletePost = async (req, res) => {
  const id = req.params.id;

  try {
    const result = await models.Posts.findOneAndDelete(
      { _id: id },
      { projection: { image: 1 } }
    );

    if (result) {
      res.status(400).json({ success: false, message: "Post not found." });
      if (result.image) {
        cleanupS3Files(result.image);
      }
    } else {
      res
        .status(200)
        .json({ success: true, message: "Post deleted successfully." });
    }
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const addWallet = async (req, res) => {
  const {
    userId,
    diamonds,
    payment_method,
    price,
    status,
    transactionId,
    merchantTransactionId,
  } = req.body;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "please provide userId" });
  }

  try {
    const walletData = await models.Wallet.create({
      userId,
      status,
      diamonds,
      price,
      payment_method,
      transactionId,
      merchantTransactionId,
    });

    if (status === "success") {
      const userData = await models.Customer.findOneAndUpdate(
        { userId },
        {
          $inc: {
            diamonds: diamonds,
            totalPurchasedDiamonds: diamonds,
          },
        },
        { new: true }
      );

      await models.UserDiamondHistory.create({
        userId,
        diamonds,
        type: 2,
        uses: "Recharge",
      });

      io.to(userId).emit("userDataUpdate", userData);
      res.status(200).json({
        success: true,
        message: "added successfully.",
        data: walletData,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Payment not completed",
        data: walletData,
      });
    }
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: `please provide userId`,
      });
    }

    const wallet = await models.Wallet.find({ userId: userId }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      success: true,
      message: "find successful.",
      data: wallet,
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const convertBeansToDiamonds = async (req, res) => {
  const { userId, diamonds, beans } = req.body;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide userId" });
  }

  try {
    const userData = await models.Customer.findOneAndUpdate(
      { _id: userId, beans: { $gte: beans } }, // Ensures enough beans are available
      {
        $inc: {
          diamonds: diamonds,
          beans: -beans,
        },
      },
      { new: true }
    );

    if (!userData) {
      return res
        .status(400)
        .json({ success: false, message: "Not enough beans" });
    }

    await models.UserDiamondHistory.create({
      userId,
      diamonds,
      type: 2,
      uses: "Beans To Diamonds",
    });

    io.to(userId).emit("userDataUpdate", userData);
    return res
      .status(200)
      .json({ success: true, message: "Converted successfully." });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const addBeans = async (req, res) => {
  const { userId, beans } = req.body;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "please provide userId" });
  }

  try {
    const userData = await models.Customer.findOneAndUpdate(
      { _id: userId },
      {
        $inc: {
          beans: beans,
        },
      },
      { new: true }
    );

    io.to(userId).emit("userDataUpdate", userData);
    res.status(200).json({ success: true, message: "added successfully." });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const shop = async (req, res) => {
  const { userId, item, itemType, price } = req.body;

  // Check for required fields
  if (!userId || !item || !itemType || !price) {
    return res.status(400).json({
      success: false,
      message: `please provide ${
        !userId ? "userId" : !item ? "item" : !itemType ? "itemType" : "price"
      }`,
    });
  }

  try {
    const user = await models.Customer.findOne(
      { _id: userId },
      {
        userId: 1,
        diamonds: 1,
        totalDiamondsUses: 1,
        xp: 1,
        frames: 1,
        chatBubbles: 1,
        themes: 1,
        vehicles: 1,
        relationship: 1,
        specialId: 1,
        lockRoom: 1,
        extraSeat: 1,
      }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "user not found",
      });
    }

    // Check if user has enough diamonds
    if (price > user.diamonds) {
      return res.status(400).json({
        success: false,
        message: "you do not have enough diamonds",
      });
    }

    const updateUserItem = (field) => {
      const index = user[field]?.findIndex(
        (f) => f._id.toString() === item._id
      );
      if (index !== -1) {
        user[field]?.splice(index, 1);
      }
      user[field]?.push(item);
    };

    switch (itemType) {
      case "frame":
        updateUserItem("frames");
        break;
      case "chatBubble":
        updateUserItem("chatBubbles");
        break;
      case "theme":
        updateUserItem("themes");
        break;
      case "vehicle":
        updateUserItem("vehicles");
        break;
      case "relationship":
        updateUserItem("relationships");
        break;
      case "specialId":
        updateUserItem("specialId");
        break;
      case "lockRoom":
        updateUserItem("lockRooms");
        break;
      case "extraSeat":
        updateUserItem("extraSeats");
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "invalid itemType provided",
        });
    }

    user.diamonds -= price;
    user.totalDiamondsUses += price;
    user.xp = (BigInt(user.xp) + BigInt(price)).toString();
    await user.save();

    const shopData = await models.Shop.create({
      userId,
      item,
      validTill: item.validTill,
      itemType,
      price,
    });

    await models.UserDiamondHistory.create({
      userId,
      diamonds: price,
      type: 1,
      uses: "Shop",
    });

    return res
      .status(200)
      .json({ success: true, message: "purchase successful", data: shopData });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const assistItems = async (req, res) => {
  const { userIds, items } = req.body;

  // Check for required fields
  if (!userIds || !items) {
    return res.status(400).json({
      success: false,
      message: `please provide ${!userIds ? "userIds" : "items"}`,
    });
  }

  try {
    for (const item of items) {
      const itemType = `${item.itemType}s`;

      for (const userId of userIds) {
        const user = await models.Customer.findById(userId)
          .select(`${itemType}`)
          .lean();

        // Filter out the existing item by _id
        const filteredItems = user[itemType].filter(
          (i) => !i._id.equals(item._id)
        );

        // Add the new item
        filteredItems.push(item);

        // Replace the entire array with filtered + new item
        await models.Customer.updateOne(
          { _id: userId },
          { $set: { [itemType]: filteredItems } }
        );
      }
    }

    return res
      .status(200)
      .json({ success: true, message: "Items assisted successfully" });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const removeItem = async (req, res) => {
  const { userId, itemType, itemId } = req.body;

  // Check for required fields
  if (!userId || !itemType || !itemId) {
    return res.status(400).json({
      success: false,
      message: `please provide ${
        !userId ? "userId" : !itemType ? "itemType" : "itemId"
      }`,
    });
  }

  try {
    const user = await models.Customer.findOneAndUpdate(
      { _id: userId },
      {
        $pull: { [itemType]: { _id: itemId } },
      }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found or item not removed",
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "item removed successfully" });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getShopHistory = async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "please provide userId" });
  }

  try {
    const data = await models.Shop.find({ userId: userId }).sort({
      createdAt: -1,
    });
    res
      .status(200)
      .json({ success: true, message: "get successful.", data: data });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const diamondSubmitFlow = async (req, res) => {
  const { userId, diamonds, type, uses } = req.body;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "please provide userId" });
  }

  try {
    let condition, updateData;
    if (type === 1) {
      condition = {
        userId,
        diamonds: { $gte: diamonds },
      };
      updateData = {
        $inc: {
          diamonds: -diamonds,
          totalDiamondsUses: diamonds,
        },
      };
    } else if (type === 2) {
      condition = {
        userId,
      };
      updateData = {
        $inc: {
          diamonds: diamonds,
        },
      };
    } else {
      return res
        .status(400)
        .json({ success: false, message: "invalid type provided." });
    }

    const userData = await models.Customer.findOneAndUpdate(
      condition,
      updateData,
      { new: true }
    );

    if (type === 1 && !userData) {
      return res.status(400).json({
        success: false,
        message: "not enough diamonds or user not found",
      });
    }

    await models.UserDiamondHistory.create({
      userId: userId,
      diamonds: diamonds,
      type: type,
      uses: uses,
    });

    io.to(userId).emit("userDataUpdate", userData);
    res.status(200).json({ success: true, message: "updated successfully." });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getDiamondHistory = async (req, res) => {
  const userId = req.params.userId;
  const { uses } = req.body;

  if (!userId || !uses) {
    return res.status(400).json({
      success: false,
      message: `please provide ${!userId ? "userId" : "uses"}`,
    });
  }

  try {
    let wallet;
    if (uses === "All") {
      wallet = await models.UserDiamondHistory.find({ userId: userId }).sort({
        createdAt: -1,
      });
    } else {
      wallet = await models.UserDiamondHistory.find({
        uses: uses,
        userId: userId,
      }).sort({ createdAt: -1 });
    }

    res
      .status(200)
      .json({ success: true, message: "find successful.", data: wallet });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const likePost = async (req, res) => {
  const { userId, postId } = req.body;

  if (!userId || !postId) {
    return res
      .status(400)
      .json({ success: false, message: "please provide userId and postId" });
  }

  try {
    const [isUserExist, isPostExist] = await Promise.all([
      models.Customer.findOne({ _id: userId }),
      models.Posts.findOne({ _id: postId }),
    ]);

    if (!isUserExist) {
      return res
        .status(400)
        .json({ success: false, message: "please provide valid user id" });
    }

    if (!isPostExist) {
      return res
        .status(400)
        .json({ success: false, message: "please provide valid post id" });
    }

    const like = await models.Like.findOne({ postId, userId });
    if (!like) {
      await models.Like.create({ postId, userId });
      res
        .status(200)
        .json({ success: true, message: "Like added for the post" });
    } else {
      await models.Like.deleteOne({ postId, userId });
      res
        .status(200)
        .json({ success: true, message: "like deleted successfully" });
    }
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const addPostComment = async (req, res) => {
  const { userId, postId, comment } = req.body;

  if (!userId || !comment || !postId) {
    return res.status(400).json({
      success: false,
      message: "please provide userId, comment, postId",
    });
  }

  try {
    const [isUserExist, isPostExist] = await Promise.all([
      models.Customer.findOne({ _id: userId }, { isCommentRestricted: 1 }),
      models.Posts.findOne({ _id: postId }),
    ]);

    if (!isUserExist) {
      return res
        .status(400)
        .json({ success: false, message: "please provide valid user id" });
    }

    if (!isPostExist) {
      return res
        .status(400)
        .json({ success: false, message: "please provide valid post id" });
    }

    if (isUserExist.isCommentRestricted) {
      return res.status(400).json({
        success: false,
        message: "Comment will be restricted on this user",
      });
    }

    await models.Comment.create({
      postId: postId,
      userId: userId,
      comment: comment,
    });

    res
      .status(200)
      .json({ success: true, message: "comment added for the post" });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updatePostComment = async (req, res) => {
  const { userId, commentId, comment } = req.body;

  if (!userId || !commentId) {
    return res.status(400).json({
      success: false,
      message: "please provide userId and commentId",
    });
  }

  try {
    const [isUserExist, isCommentExist] = await Promise.all([
      models.Customer.findOne({ _id: userId }),
      models.Comment.findOne({ _id: commentId }),
    ]);

    if (!isUserExist) {
      return res
        .status(400)
        .json({ success: false, message: "please provide valid user id" });
    }

    if (!isCommentExist) {
      return res
        .status(400)
        .json({ success: false, message: "please provide valid commentId id" });
    }

    if (!isCommentExist.userId.equals(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "you are not authorized" });
    }

    await models.Comment.updateOne(
      { _id: commentId },
      {
        $set: { comment: comment },
      }
    );

    res
      .status(200)
      .json({ success: true, message: "comment updated successfully" });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getPostComment = async (req, res) => {
  try {
    const comments = await models.Comment.find({});

    return res.status(200).json({
      success: true,
      message: "comment get successful",
      data: comments,
    });
  } catch (error) {
    logger.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const deletePostComment = async (req, res) => {
  const { userId, commentId } = req.body;

  if (!userId || !commentId) {
    return res.status(400).json({
      success: false,
      message: "please provide userId and commentId",
    });
  }

  try {
    const [isUserExist, isCommentExist] = await Promise.all([
      models.Customer.findOne({ _id: userId }),
      models.Comment.findOne({ _id: commentId }),
    ]);

    if (!isUserExist) {
      return res
        .status(400)
        .json({ success: false, message: "please provide valid user id" });
    }

    if (!isCommentExist) {
      return res
        .status(400)
        .json({ success: false, message: "please provide valid commentId id" });
    }

    if (!isCommentExist.userId.equals(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "you are not authorized" });
    }

    await models.Comment.deleteOne({ _id: commentId });

    res
      .status(200)
      .json({ success: true, message: "comment deleted successfully" });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getFollowingUsers = async (req, res) => {
  const id = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const user = await models.Customer.findOne({ _id: id }, { following: 1 });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    const followingUserIds = user.following;
    if (!followingUserIds || followingUserIds.length === 0) {
      return res
        .status(200)
        .json({ success: true, message: "No following users" });
    }

    const pipeline = [
      {
        $match: { createdBy: { $in: followingUserIds } },
      },
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "postId",
          as: "comments",
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "comments.userId",
          foreignField: "_id",
          as: "commented.userDetails",
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "postId",
          as: "likes",
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "likes.userId",
          foreignField: "_id",
          as: "like.userDetails",
        },
      },
      {
        $project: {
          commented: 0,
          like: 0,
        },
      },
      {
        $sort: { createdAt: -1 }, // Sort in descending order
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const posts = await models.Posts.aggregate(pipeline);
    return res
      .status(200)
      .json({ success: true, message: "User post details", data: posts });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const searchUser = async (req, res) => {
  const userId = req.params.userId;

  try {
    const customers = await models.Customer.find({
      userId: { $regex: userId, $options: "i" },
    });

    if (!customers) {
      res.status(400).json({ success: true, message: "User not found." });
    } else {
      res.status(200).json({
        success: true,
        message: "Get successful.",
        data: customers,
      });
    }
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getPushMessage = async (req, res) => {
  const id = req.params.id;

  try {
    const host = await models.PushMessage.find({ userId: id });
    res
      .status(200)
      .json({ success: true, message: "Find successfully.", data: host });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const deletePushMessage = async (req, res) => {
  const id = req.params.id;

  try {
    await models.PushMessage.deleteOne({ _id: id });
    res.status(200).json({ success: true, message: "Deleted successfully." });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const agencyLogin = async (req, res) => {
  const { mobile } = req.body;

  try {
    const customer = await models.Agency.loginMobile(mobile);

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Login failed! Check authentication credentials",
      });
    }

    res
      .status(200)
      .json({ success: true, message: "Login successful.", data: customer });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteUserDp = async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await models.Customer.findOne({ userId: userId });

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
    }

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "user is not available" });
    }

    const userData = await models.Customer.findOneAndUpdate(
      { userId: userId },
      {
        $set: {
          images: constants.banDpLink,
        },
      },
      { new: true }
    );

    io.to(userId).emit("userDataUpdate", userData);
    res.status(200).json({ success: true, message: "Dp Ban successful." });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getReports = async (req, res) => {
  const { userId, message } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "please provide userId",
    });
  }

  try {
    const users = await models.Customer.findOne({ _id: userId }, { _id: 1 });
    if (!users) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const report = await models.UserReport.create({
      userId,
      message,
    });

    res.status(200).json({
      success: true,
      message: "Report added successfully.",
      data: report,
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const addReports = async (req, res) => {
  try {
    const report = await models.UserReport.find({}).populate("userId");

    res
      .status(200)
      .json({ success: true, message: "Find successful.", data: report });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getGifts = async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "please provide userId",
    });
  }

  try {
    const matchStage = {
      $or: [
        { sender: mongoose.Types.ObjectId.createFromHexString(userId) },
        { receiver: mongoose.Types.ObjectId.createFromHexString(userId) },
      ],
    };

    const gifts = await models.SendGift.aggregate([
      {
        $match: matchStage,
      },
      {
        $unwind: "$gift",
      },
      {
        $group: {
          _id: {
            giftId: "$gift._id",
            name: "$gift.name",
            thumbnail: "$gift.thumbnail",
          },
          totalSent: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$sender",
                    mongoose.Types.ObjectId.createFromHexString(userId),
                  ],
                },
                "$count",
                0,
              ], // Count sent gifts
            },
          },
          totalReceived: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$receiver",
                    mongoose.Types.ObjectId.createFromHexString(userId),
                  ],
                },
                "$count",
                0,
              ], // Count received gifts
            },
          },
          totalDiamondsSent: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$sender",
                    mongoose.Types.ObjectId.createFromHexString(userId),
                  ],
                },
                { $multiply: ["$count", "$gift.diamonds"] },
                0,
              ],
            },
          },
          totalDiamondsReceived: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$receiver",
                    mongoose.Types.ObjectId.createFromHexString(userId),
                  ],
                },
                { $multiply: ["$count", "$gift.diamonds"] },
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          giftId: "$_id.giftId",
          name: "$_id.name",
          thumbnail: "$_id.thumbnail",
          totalSent: { $ifNull: ["$totalSent", 0] }, // Ensure 0 if no sent gifts
          totalReceived: { $ifNull: ["$totalReceived", 0] }, // Ensure 0 if no received gifts
          totalDiamondsSent: { $ifNull: ["$totalDiamondsSent", 0] },
          totalDiamondsReceived: { $ifNull: ["$totalDiamondsReceived", 0] },
        },
      },
    ]);

    if (!gifts) {
      return res.status(400).json({
        success: false,
        message: "Gifts not found",
      });
    }

    res.status(200).json({ success: true, data: gifts });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getTopSupporters = async (req, res) => {
  const userId = req.customer?._id;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "token is required" });
  }

  const startDate = moment().startOf("month").toDate(); // First day of the month at 00:00:00
  const endDate = moment().endOf("month").toDate();

  try {
    const results = await models.SendGift.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $addFields: {
          giftDiamonds: { $multiply: ["$gift.diamonds", "$count"] },
        },
      },
      {
        $group: {
          _id: "$sender", // Group by sender
          totalGiftDiamonds: { $sum: "$giftDiamonds" },
        },
      },
      {
        $sort: { totalGiftDiamonds: -1 },
      },
      {
        $limit: 10,
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "sender",
        },
      },
      {
        $unwind: "$sender",
      },
      {
        $project: {
          _id: 0,
          totalGiftDiamonds: 1,
          sender: 1, // includes full customer document
        },
      },
    ]);

    res
      .status(200)
      .json({ success: true, message: "Find successfull.", data: results });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    logger.error(error);
  }
};

const banDevice = async (req, res) => {
  const { userId, isActiveDevice } = req.body;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "userId is required." });
  }

  try {
    const user = await models.Customer.findOneAndUpdate(
      { _id: userId },
      { $set: { isActiveDevice: isActiveDevice } },
      { new: true }
    );

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Customer not found" });
    }

    if (user.deviceId) {
      await models.Customer.updateMany(
        {
          $and: [{ deviceId: user.deviceId }, { deviceId: { $ne: null } }],
        },
        { $set: { isActiveDevice: isActiveDevice } }
      );

      if (!isActiveDevice) {
        await models.BannedDevice.create({ deviceId: user.deviceId });
      } else {
        await models.BannedDevice.deleteOne({ deviceId: user.deviceId });
      }
    }

    io.to(user._id).emit("userDataUpdate", user);
    res.status(200).json({ success: true, message: "Device ban successfull." });
  } catch (error) {
    if (error.code === 11000) {
      res
        .status(400)
        .json({ success: true, message: "Device already banned." });
    } else {
      res.status(400).json({ success: false, message: error.message });
    }
    logger.error(error);
  }
};

const purchaseSpecialId = async (req, res) => {
  try {
    const { userId, specialId, validityDays, price } = req.body;

    if (!userId || !specialId || !validityDays || !price) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const user = await models.Customer.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.diamonds < price) {
      return res.status(400).json({ message: "Insufficient diamonds." });
    }

    const existing = await models.Customer.findOne({ userId: specialId });
    if (existing) {
      return res.status(409).json({ message: "Special ID already taken." });
    }

    const originalUserId = user.userId;
    const expiryDate = new Date(
      Date.now() + validityDays * 24 * 60 * 60 * 1000
    );

    user.oldUserId = originalUserId;
    user.userId = specialId;
    user.specialIdValidity = expiryDate;
    user.diamonds -= price;

    await user.save();

    // Diamond history
    await models.UserDiamondHistory.create({
      userId: user._id,
      diamonds: price,
      type: 1, // Debited
      uses: "Shop",
    });

    res.status(200).json({
      success: true,
      message: `Special ID '${specialId}' purchased successfully, valid for ${validityDays} days.`,
      expiresAt: expiryDate,
    });
  } catch (err) {
    console.error("purchaseSpecialId error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

const setUserOnline = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "Missing userId" });
  }

  try {
    await models.Customer.updateOne(
      { _id: userId },
      {
        $set: {
          isOnline: true,
          lastActiveAt: new Date(),
        },
      }
    );

    res.status(200).json({ success: true, message: "User marked as online" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const setUserOffline = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "Missing userId" });
  }

  try {
    await models.Customer.updateOne(
      { _id: userId },
      {
        $set: {
          isOnline: false,
          lastActiveAt: new Date(),
        },
      }
    );

    res.status(200).json({ success: true, message: "User marked as offline" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  login,
  register,
  getPagination,
  getCustomers,
  getCustomersById,
  getViewCount,
  getByMultipleId,
  getOtp,
  updateCustomer,
  updateMobileEmail,
  setDefaultItem,
  followUser,
  logout,
  addPost,
  getAllPosts,
  getPostsPagination,
  getPostsByUserId,
  deletePost,
  addWallet,
  getWalletTransactions,
  convertBeansToDiamonds,
  addBeans,
  shop,
  assistItems,
  removeItem,
  getShopHistory,
  diamondSubmitFlow,
  getDiamondHistory,
  likePost,
  addPostComment,
  updatePostComment,
  getPostComment,
  deletePostComment,
  getFollowingUsers,
  searchUser,
  getPushMessage,
  deletePushMessage,
  agencyLogin,
  deleteUserDp,
  getReports,
  addReports,
  getGifts,
  getTopSupporters,
  banDevice,
  purchaseSpecialId,
  setUserOnline,
  setUserOffline,
};
