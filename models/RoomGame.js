const mongoose = require("mongoose");
const RoomGameSchema = new mongoose.Schema(
    {

    name: {
        type: String,
    },

    image: {
        type: String
    },

    webUrl: {
        type: String
    },

    requiredRecharge: {
        type: Number
    },

    isActive: {
        type: Boolean,
        default: true
    }
    },
    {
        timestamps: true
    }
);

const RoomGame = mongoose.model("roomGame", RoomGameSchema);

module.exports = RoomGame;
