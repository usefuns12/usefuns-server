const mongoose = require("mongoose");

const CarouselSchema = new mongoose.Schema(
    {
        carouselImage: {
            type: String,
            required: true,
        },
        actionLink: {
            type: String,
        },
        countryCode: {
            type: String,
            default: null
        },
        isActive: { type: Boolean, required: true, default: true },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("carousel", CarouselSchema);