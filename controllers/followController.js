import followModel from "../models/followSchema.js";
import mongoose from "mongoose";
import { verifyAccessToken } from "../utils/userUtils.js";

// Toggle follow
export const toggleFollow = async (req, res) => {
    try {
        const token = req.headers?.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ error: "Token not found" });
        const decoded = await verifyAccessToken(token);
        if (!decoded.id) return res.status(401).json({ error: "Unauthorized access. Invalid token." });

        // Find user
        let targetId = req.params.id;
        targetId = mongoose.Types.ObjectId.createFromHexString(targetId);
        const myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        if (!targetId) return res.status(400).json({ error: "Please specify who you want to follow." });
        if (myId.toString() === targetId.toString()) return res.status(400).json({ message: "You cannot follow yourself." });

        const existing = await followModel.findOne({ follower: myId, following: targetId });

        if (existing) {
            // Unfollow
            await followModel.findByIdAndDelete(existing._id);
            return res.status(200).json({ message: "Unfollowed successfully" });
        } else {
            // Follow
            await followModel.create({ follower: myId, following: targetId });
            return res.status(200).json({ message: "Followed successfully" });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
}

// Get followers
export const getFollowers = async (req, res) => {
    try {
        const token = req.headers?.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ error: "Token not found" });
        const decoded = await verifyAccessToken(token);
        if (!decoded.id) return res.status(401).json({ error: "Unauthorized access. Invalid token." });

        // Check if param is "me" or another userId
        let targetId = req.params.id === "me" ? decoded.id : req.params.id;

        const userId = mongoose.Types.ObjectId.createFromHexString(targetId);
        const { cursor, limit = 20 } = req.query;

        const query = { following: userId };
        if (cursor) { query._id = { $gt: mongoose.Types.ObjectId.createFromHexString(cursor) } };

        let followers = await followModel.find(query)
            .sort({ _id: 1 })
            .limit(Number(limit) + 1)
            .populate("follower", "profile_name username avatar")
            .lean();

        let nextCursor = null;
        if (followers.length > limit) {
            nextCursor = followers[limit]._id.toString();
            followers.pop();
        }

        res.json({ followers: followers.map(f => f.follower), nextCursor });

    } catch (error) {
        console.error("Error fetching followers:", error);
        res.status(500).json({ error: "Server error while fetching followers" });
    }
};

// Get followings of a user
export const getFollowing = async (req, res) => {
    try {
        const token = req.headers?.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ error: "Token not found" });
        const decoded = await verifyAccessToken(token);
        if (!decoded.id) return res.status(401).json({ error: "Unauthorized access. Invalid token." });

        let targetId = req.params.id === "me" ? decoded.id : req.params.id;

        const userId = mongoose.Types.ObjectId.createFromHexString(targetId);
        const { cursor, limit = 20 } = req.query;

        const query = { follower: userId };
        if (cursor) { query._id = { $gt: mongoose.Types.ObjectId.createFromHexString(cursor) } };

        let following = await followModel.find(query)
            .sort({ _id: 1 })
            .limit(Number(limit) + 1)
            .populate("following", "profile_name username avatar")
            .lean();

        let nextCursor = null;
        if (following.length > limit) {
            nextCursor = following[limit]._id.toString();
            following.pop();
        }

        res.json({ following: following.map(f => f.following), nextCursor });

    } catch (error) {
        console.error("Error fetching following:", error);
        res.status(500).json({ error: "Server error while fetching following" });
    }
};
