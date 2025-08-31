import postsModel from "../models/postsSchema.js";
import reportModel from "../models/reportModel.js";
import userModel from "../models/userSchema.js";
import { verifyAccessToken } from "../utils/userUtils.js";
import mongoose from "mongoose";


// Create report
export const createReport = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

        const { type, targetId, reason, details } = req.body;
        if (!type || !targetId || !reason) return res.status(400).json({ error: "Missing required fields" });
        if (!mongoose.Types.ObjectId.isValid(targetId)) return res.status(400).json({ error: "Invalid targetId" });

        // Prevent duplicate reports by same user
        const target_id = mongoose.Types.ObjectId.createFromHexString(targetId);
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        const existing = await reportModel.findOne({ reporterId: userId, targetId: target_id });
        if (existing) return res.status(400).json({ error: "You have already reported this item." });

        // Create a report
        const report = await reportModel.create({ reporterId: userId, type, targetId: target_id, reason, details });

        // Automated report checking
        const reportsCount = await reportModel.countDocuments({ type, targetId: target_id, expired: false });

        const POST_THRESHOLD = 45;
        const USER_THRESHOLD = 10;
        let actionTaken = null;

        if (type === "post" && reportsCount >= POST_THRESHOLD) {
            await postsModel.findByIdAndUpdate(target_id, {
                $set: {
                    suspended: true,
                    suspended_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                }
            });
            actionTaken = { action: "post_hidden", durationDays: 14 };
        }

        if (type === "user" && reportsCount >= USER_THRESHOLD) {
            await userModel.findByIdAndUpdate(target_id, {
                $set: {
                    suspended: true,
                    suspended_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                }
            });
            actionTaken = { action: "user_suspended", durationDays: 14 };
        }

        // --- Log action in report (for audit) ---
        if (actionTaken) {
            actionTaken.suspended_until = actionTaken.durationDays ? new Date(Date.now() + actionTaken.durationDays * 24 * 60 * 60 * 1000) : null;
            await reportModel.findByIdAndUpdate(report._id, { $set: { actionTaken } });
        }

        res.status(201).json({ message: "Report submitted successfully" });

    } catch (err) {
        console.error("Error creating report:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};
