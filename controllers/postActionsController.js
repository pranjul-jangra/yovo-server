import mongoose from "mongoose";
import saveModel from "../models/saveSchema.js";
import { verifyAccessToken } from "../utils/userUtils.js";
import postsModel from "../models/postsSchema.js";

// Toggle save
export const toggleSave = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    let { postId } = req.params;
    postId = mongoose.Types.ObjectId.createFromHexString(postId);

    // check if already saved
    const existing = await saveModel.findOne({ userId, postId });

    if (existing) {
      await saveModel.deleteOne({ _id: existing._id });
      return res.status(200).json({ success: true, saved: false, message: "Post unsaved" });
    }

    // save
    await saveModel.create({ userId, postId });
    res.status(201).json({ success: true, saved: true, message: "Post saved" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error toggling save" });
  }
};

// Hide a post
export const hidePost = async (req, res) => {
  try {
    let { postId } = req.params;
    if (!postId) return res.status(400).json({ error: "Post is not defined" });
    postId = mongoose.Types.ObjectId.createFromHexString(postId);

    // Verify user
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token missing" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    // Update post only if owned by the user
    const post = await postsModel.findOneAndUpdate(
      { _id: postId, userId },
      { $set: { hide_post: true } },
      { new: true }
    );

    if (!post) return res.status(404).json({ error: "Post not found or not authorized" });
    res.status(200).json({ message: "Post hidden successfully" });

  } catch (error) {
    console.error("Error hiding post:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Unhide a post
export const unhidePost = async (req, res) => {
  try {
    let { postId } = req.params;
    if (!postId) return res.status(400).json({ error: "Post is not defined" });
    postId = mongoose.Types.ObjectId.createFromHexString(postId);

    // Verify user
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token missing" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    // Update post only if owned by the user
    const post = await postsModel.findOneAndUpdate(
      { _id: postId, userId },
      { $set: { hide_post: false } },
      { new: true }
    );

    if (!post) return res.status(404).json({ error: "Post not found or not authorized" });
    res.status(200).json({ message: "Post unhidden successfully" });

  } catch (error) {
    console.error("Error unhiding post:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


