import mongoose from "mongoose";
import { verifyAccessToken } from "../utils/userUtils.js";
import userModel from "../models/userSchema.js";
import { extractPublicId } from "../utils/extractPublicId.js";
import { cloudinary } from "../middlewares/multer.js";
import postsModel from "../models/postsSchema.js";
import followModel from "../models/followSchema.js";


// Update avatar
export const updateAvatar = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing" });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const oldAvatar = user.avatar;

        // If user wants to remove avatar
        if (req.body.removeAvatar === "true" || req.body.removeAvatar) {
            if (oldAvatar && oldAvatar.includes("cloudinary")) {
                const publicId = await extractPublicId(oldAvatar);
                if (publicId) await cloudinary.uploader.destroy(publicId);
            }

            user.avatar = "/user.png";
            await user.save();
            return res.status(200).json({ message: "Avatar removed successfully", avatar: user.avatar });
        }

        // If user is uploading new avatar
        if (req.file && req.file.path) {
            // Delete previous avatar if it exists in Cloudinary
            if (oldAvatar && oldAvatar.includes("cloudinary")) {
                const publicId = extractPublicId(oldAvatar);
                if (publicId) await cloudinary.uploader.destroy(publicId);
            }

            user.avatar = req.file.path;
            await user.save();
            return res.status(200).json({ message: "Avatar updated successfully", avatar: user.avatar });
        }
        return res.status(400).json({ error: "No file provided or invalid request" });

    } catch (error) {
        console.log("Error updating profile picture:", error);
        res.status(500).json({ error: "Error updating profile picture due to server error" });
    }
}

// Update user profile
export const updateProfile = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Convert string ID to ObjectId
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        const { username, email, profile_name, profile_website, bio, DOB, marital_status, gender, social_links } = req.body;

        // Check for duplicate username
        const duplicateUsername = await userModel.findOne({ username });
        if (duplicateUsername.email !== email) return res.status(409).json({ error: "This username has already been taken." });

        const updateData = {
            ...(username && { username }),
            ...(profile_name && { profile_name }),
            ...(bio && { bio }),
            ...(Array.isArray(social_links) && { social_links }),

            ...(profile_website && {
                profile_website: {
                    website: profile_website.website || "",
                    display_on_profile: profile_website.display_on_profile || false,
                }
            }),

            ...(DOB && {
                DOB: {
                    date: DOB.date || "",
                    display_on_profile: DOB.display_on_profile || false,
                }
            }),

            ...(marital_status && {
                marital_status: {
                    status: marital_status.status || "",
                    display_on_profile: marital_status.display_on_profile || false,
                }
            }),

            ...(gender && {
                gender: {
                    g: gender.g || "",
                    display_on_profile: gender.display_on_profile || false,
                }
            }),
        };

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        );

        res.status(200).json({ message: "Profile updated successfully", user: updatedUser });

    } catch (error) {
        console.log("Error updating profile:", error);
        res.status(500).json({ error: "Error updating profile due to server error" });
    }
}

// Get user profile
export const getProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        let profileUserId;
        let myId;

        // Get myId
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token missing" });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded?.id) return res.status(401).json({ error: "Unauthorized. Invalid token" });
        myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Handle "me" case
        if (userId === "me") {
            profileUserId = myId;
        } else {
            if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "Invalid user ID" });
            profileUserId = mongoose.Types.ObjectId.createFromHexString(userId);
        }

        // Fetch user details in parallel
        const [user, totalPosts, followersCount, followingCount, isFollowing] = await Promise.all([
            userModel.findById(profileUserId).lean(),
            postsModel.countDocuments({ userId: profileUserId, draft: false, hide_post: false, suspended: false }),
            followModel.countDocuments({ following: profileUserId }), // how many follow this user
            followModel.countDocuments({ follower: profileUserId }),   // how many this user follows
            followModel.exists({ follower: myId, following: profileUserId }) // am I following?
        ]);

        if (!user) return res.status(404).json({ error: "User not found" });

        res.status(200).json({
            user: {
                ...user,
                total_posts: totalPosts,
                followers_count: followersCount,
                following_count: followingCount,
                isFollowing: !!isFollowing
            }
        });

    } catch (error) {
        console.error("Error getting profile:", error);
        res.status(500).json({ error: "Error getting profile due to server error" });
    }
};

