import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
    postId: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    caption: String,
    tags: [String],
    disable_comments: { type: Boolean, default: false },

    draft: { type: Boolean, default: false },
    hide_post: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
    suspended_until: { type: Date, default: null },

    images: [String],
    video: String,

    likes_count: { type: Number, default: 0 },
    comments_count: { type: Number, default: 0 },
    share_count: { type: Number, default: 0 },

}, { timestamps: true });


const postsModel = mongoose.model('Post', postSchema);
export default postsModel;