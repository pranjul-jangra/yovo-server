import mongoose from "mongoose";
import activityModel from "../models/ActivitySchema.js";
import { verifyAccessToken } from "../utils/userUtils.js";

// Fetch recent Activities
export const getActivities = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const { page = 1, limit = 10, type = "all" } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build filter
        let filter = {};
        if (type === "actions") {
            filter = { actor: userId };     // things I did
        } else if (type === "received") {
            filter = { recipient: userId };   // things done to me
        } else if (type === "all") {
            filter = { $or: [{ actor: userId, recipient: userId }, { recipient: userId }] };  // both
        }

        // Query activities
        const activities = await activityModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate("actor", "username avatar")
            .populate("recipient", "username avatar")
            .populate("targetPost", "caption")
            .populate("targetComment", "text");

        // Count total docs for pagination
        const total = await activityModel.countDocuments(filter);
        res.json({ page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), totalActivities: total, activities,});
        
    } catch (error) {
        console.error("Error fetching activities:", error);
        res.status(500).json({ error: "Server error fetching activities" });
    }
};
