const mongoose = require("mongoose");

const OfficialUserSchema = new mongoose.Schema(
    {
          name: {
               type: String,
               required: true,
          },
          profileImage: {
               type: String,
               required: true,
          },
          title: {
               type: String,
          },
          logo: {
               type: String,
               required: true,
          },
          role: {
               type: [String],
               enum: ["manager", "countryAdmin", "admin", "subAdmin", "agency", "host"],
               required: true
          },
          userId: {
               type: String,
               required: true,
               unique: true,
               trim: true,
          },
          countryCard: {
               type: String,
               /* required: true, */
          },
          countryCode: {
               type: String,
               required: true,
          },
          mobile: {
               type: Number,
               required: true,
          },
          email: {
               type: String,
               required: true,
          },
          createdBy: {
               type: mongoose.Schema.Types.ObjectId,
               default: null,
               ref: "officialusers"
          },
          isActive: {
               type: Boolean,
               default: true
          }
     },
     {
          timestamps: true,
     }
);

module.exports = mongoose.model("officialUser", OfficialUserSchema);