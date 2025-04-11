const mongoose = require("mongoose");
const Gift = require('./Gift');

const SendGiftSchema = new mongoose.Schema(
     {
          roomId: {
               type: mongoose.Schema.Types.ObjectId,
               required: true,
          },

          sender: {
               type: mongoose.Schema.Types.ObjectId,
               required: true,
               ref: "customers"
          },
          receiver: {
               type: mongoose.Schema.Types.ObjectId,
               required: true,
               ref: "customers"
          },
          count: {
               type: Number,
               required: true,
          },
          gift: Gift.schema
     },
     {
          timestamps: true,
     }
);

module.exports = mongoose.model("sendGift", SendGiftSchema);