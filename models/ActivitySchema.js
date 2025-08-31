import mongoose from "mongoose";

const activitySchema = new mongoose.Schema({
    // Who performed the action
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Who/what the action is about
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // e.g. post owner
    targetPost: { type: mongoose.Schema.Types.ObjectId, ref: "Post" }, // if related to a post
    targetComment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" }, // if related to a comment

    // What happened
    type: {
        type: String,
        enum: [
            "post_created",
            "like_post",
            "comment_post",
            "follow_user",
            "unfollow_user",
        ],
        required: true,
    },

    message: { type: String },
    createdAt: { type: Date, default: Date.now },
});

const activityModel = mongoose.model("Activity", activitySchema);
export default activityModel;
