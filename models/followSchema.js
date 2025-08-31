import mongoose from "mongoose";

const followSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // who follows
  following: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true } // who is being followed
}, { timestamps: true });

followSchema.index({ follower: 1, following: 1 }, { unique: true });

const followModel = mongoose.model("Follow", followSchema);
export default followModel;