const express = require("express");
const controller = require("../controllers/customer.controller");
const middleware = require("../middlewares");

const router = express.Router();

router.route("/login").post(controller.login);
router
  .route("/register")
  .post(middleware.uploads.single("file"), controller.register);
router.route("/getAll/limitedData").get(controller.getPagination); // For Admin
router.route("/getAll").get(controller.getCustomers);
router.route("/getUnassignedUsers").get(controller.getUnassignedUsers);
router.route("/getById/:id").get(controller.getCustomersById);
router.route("/viewCount/:id").get(controller.getViewCount);
router.route("/getByMultipleId").get(controller.getByMultipleId);
router.route("/getOtp").post(controller.getOtp);
router
  .route("/update/:id")
  .put(
    middleware.auth.authCustomer,
    middleware.uploads.single("file"),
    controller.updateCustomer
  );
router
  .route("/setDefaultItem")
  .put(middleware.auth.authCustomer, controller.setDefaultItem);
router.route("/follow").post(controller.followUser);
router
  .route("/getTopSupporters")
  .get(middleware.auth.authCustomer, controller.getTopSupporters);
/* router.route("/updateMobileEmail/:id").put(controller.updateMobileEmail);
router.route("/logout/:id").post(controller.logout); */
router.route("/post/all").get(controller.getAllPosts);
router.route("/post/getall").get(controller.getPostsPagination); // For Admin
router.route("/post/getByUserId/:createdBy").get(controller.getPostsByUserId);
router
  .route("/post/add")
  .post(
    middleware.auth.authCustomer,
    middleware.uploads.single("file"),
    controller.addPost
  );
router.route("/post/like").post(controller.likePost);
router.route("/post/delete/:id").delete(controller.deletePost);
router.route("/post/addComment").post(controller.addPostComment);
router.route("/post/updateComment").put(controller.updatePostComment);
router.route("/post/getComment").get(controller.getPostComment);
router.route("/post/deleteComment").delete(controller.deletePostComment);
router.route("/post/followingUser/:id").get(controller.getFollowingUsers);
router.route("/wallet/add").post(controller.addWallet);
router
  .route("/wallet/transaction/:userId")
  .get(controller.getWalletTransactions);
router
  .route("/beansToDiamonds/convert")
  .post(controller.convertBeansToDiamonds);
router
  .route("/beans/add")
  .post(middleware.auth.authCustomer, controller.addBeans);
router.route("/shop").post(controller.shop);
router.route("/assistItems").post(controller.assistItems);
router.route("/removeItem").post(controller.removeItem);
router.route("/shop/history/:userId").get(controller.getShopHistory);
router.route("/diamondSubmitFlow").post(controller.diamondSubmitFlow);
router.route("/diamond/transaction/:userId").post(controller.getDiamondHistory);
router.route("/search/:userId").get(controller.searchUser);
router.route("/pushMessageById/:id").get(controller.getPushMessage);
router.route("/pushMessageDelete/:id").delete(controller.deletePushMessage);
router.route("/agency/loginMobile").post(controller.agencyLogin);
router.route("/deleteUserDp/:userId").delete(controller.deleteUserDp); // For Admin
router.route("/report/getReports").get(controller.getReports);
router.route("/report/add").post(controller.addReports);
router.route("/getGifts/:userId").get(controller.getGifts);
router.route("/banDevice").post(controller.banDevice);
router.route("/purchase-special-id").post(controller.purchaseSpecialId);

// user active status
router.route("/set-online").post(controller.setUserOnline);
router.route("/set-offline").post(controller.setUserOffline);

router.route("/assistSpecialIdItems").post(controller.assistSpecialIdItems);

// Block User
router.route("/block").post(controller.blockUser);
router.route("/unblock").post(controller.unblockUser);
router.route("/blocked-users/:userId").get(controller.getBlockedUsers);

router.route("/top-referrers").get(controller.getTopReferrers);
router.route("/referrals/:userId").get(controller.getReferralDetails);

router.route("/withdraw-referral-beans").post(controller.withdrawReferralBeans);

router.route("/referral/transactions").get(controller.getReferralTransactions);

module.exports = router;
