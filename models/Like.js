const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "customers"
    },
    postId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "posts"
    }
});

module.exports = mongoose.model('likes', likeSchema);