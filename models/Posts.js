const mongoose = require("mongoose");

const PostsSchema = new mongoose.Schema(
    {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "customers"
        },
        caption: {
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

module.exports = mongoose.model("posts", PostsSchema);