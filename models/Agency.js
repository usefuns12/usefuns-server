const mongoose = require("mongoose");
const AgencySchema = new mongoose.Schema(
     {
          userId: {
               type: String,
               required: true,
          },
          code: {
               type: String,
               unique: true,

          },
          countryCode: {
               type: String,
               required: true,
          },
          name: {
               type: String,

          },
          admin: {
               type: String,

          },
          subAdmin: {
               type: String,

          },
          mobile: {
               type: Number,
               required: true,
               unique: true
          },
          email: {
               type: String,
          },
          image: {
               type: String,
               required: true,
          },

          isActive: { type: Boolean, required: true, default: true },
     },
     {
          timestamps: true,
     }
);

AgencySchema.statics.loginMobile = async function (mobile) {
     const customer = await this.findOne({
          mobile: mobile,
     });
     
     if (!customer) {
          throw new Error("Invalid credentials.");
     }
     if (!customer.isActive) {
          throw new Error("Your account has been deactivated.");
     }

     return customer;
};

module.exports = mongoose.model("agency", AgencySchema);