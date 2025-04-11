const mongoose = require("mongoose");
const BannedDeviceSchema = new mongoose.Schema(
     {

          deviceId: {
               type: String,
               required: true,
               unique: true
          },
     },
     {
          timestamps: true,
     }
);

const BannedDevice = mongoose.model("bannedDevice", BannedDeviceSchema);

module.exports = BannedDevice;
