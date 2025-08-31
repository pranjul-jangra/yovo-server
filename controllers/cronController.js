import postsModel from "../models/postsSchema.js";
import reportModel from "../models/reportModel.js";
import userModel from "../models/userSchema.js";


// Soft delete older reports
export const expireOlderReports = async () => {
    try {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        await reportModel.updateMany(
            { createdAt: { $lt: cutoff }, expired: false },
            { $set: { expired: true } }
        );
    } catch (err) {
        console.error("Error expiring reports:", err);
    }
}

// Unsuspend user or posts
export const unsuspendJob = async () => {
    try {
        const now = new Date();

        await postsModel.updateMany(
            { suspended: true, suspended_until: { $lte: now } },
            { $set: { suspended: false }, $unset: { suspended_until: "" } }
        );

        await userModel.updateMany(
            { suspended: true, suspended_until: { $lte: now } },
            { $set: { suspended: false }, $unset: { suspended_until: "" } }
        );

    } catch (err) {
        console.error("Error unsuspending posts/users:", err);
    }
}