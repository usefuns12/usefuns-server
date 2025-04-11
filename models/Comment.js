const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "customers"
    },
    postId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "posts"
    },
    comment: {
        type: String,
        default: null
    },
});

module.exports = mongoose.model('comments', commentSchema);