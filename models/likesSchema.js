import mongoose from "mongoose";

const likesSchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

likesSchema.index({ postId: 1, userId: 1 }, { unique: true });


const likesModel = mongoose.model("Like", likesSchema);
export default likesModel;
