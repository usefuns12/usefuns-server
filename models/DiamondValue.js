const mongoose = require("mongoose");
const DiamondValueSchema = new mongoose.Schema(
    {
        diamond: {
            type: Number,
            required: true
        },
        extraDiamond: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("diamondValue", DiamondValueSchema);