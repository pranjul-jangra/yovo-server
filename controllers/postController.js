import postsModel from "../models/postsSchema.js";
import likesModel from "../models/likesSchema.js";
import commentsModel from "../models/commentsSchema.js";
import userModel from "../models/userSchema.js";
import crypto from "crypto";
import mongoose from "mongoose";
import tagsModel from "../models/tagsSchema.js";
import { verifyAccessToken } from "../utils/userUtils.js";
import activityModel from "../models/ActivitySchema.js";
import { cloudinary } from "../middlewares/multer.js";
import { extractPublicId } from "../utils/extractPublicId.js";
import saveModel from "../models/saveSchema.js";


const generateAlphanumericId = () => {
    return crypto.randomBytes(16).toString('hex').slice(0, 8);
}

// Create post
export const createPost = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Convert string ID to ObjectId
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const postId = generateAlphanumericId();

        // Extracting data
        let { caption = '', tags = [], disable_comments, draft = false } = req.body;
        disable_comments = (disable_comments === true || disable_comments === "true") ? true : false;
        draft = (draft === true || draft === "true") ? true : false;

        const images = req.files?.images || [];
        const video = req.files?.video?.[0] || null;

        if (images.length > 0 && video) return res.status(400).json({ error: "You can only upload either multiple images or a single video per post." });

        // Extracting URLs
        const imageUrls = images.map(file => file.path);
        const videoUrl = video ? video.path : null;

        // Upsert tags
        if (!Array.isArray(tags)) tags = tags ? [tags] : [];
        tags = tags.map(tag => tag.toLowerCase());
        await Promise.all(tags.map(async tagName => {
            await tagsModel.findOneAndUpdate(
                { name: tagName.toLowerCase() },
                { $inc: { usageCount: 1 } },
                { upsert: true }
            );
        }));

        // Create post
        const newPost = await postsModel.create({ postId, userId, caption, disable_comments, draft, tags, images: imageUrls, video: videoUrl });

        // Create activity
        if (!draft) await activityModel.create({ actor: userId, recipient: userId, targetPost: newPost._id, type: "post_created", message: "Created a new post" });

        res.status(201).json({ message: "Post created", post: newPost });

    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get post
export const getPosts = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });
        let userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Cursor & limit
        const { cursor, limit = 10 } = req.query;
        const parsedLimit = parseInt(limit);

        const matchStage = { draft: false, hide_post: false, suspended: false };
        if (cursor) { matchStage._id = { $lt: mongoose.Types.ObjectId.createFromHexString(cursor) } };

        const posts = await postsModel.aggregate([
            { $match: matchStage },
            { $sort: { createdAt: -1 } },
            { $limit: parsedLimit + 1 }, // fetch one extra to check "hasNextPage"

            // Fetch post owner info
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$userId" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                        { $project: { username: 1, avatar: 1, profile_name: 1 } }
                    ],
                    as: "user"
                }
            },

            // Check if current user follows the post owner
            {
                $lookup: {
                    from: "follows",
                    let: { postOwnerId: "$userId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$follower", userId] },   // I followed
                                        { $eq: ["$following", "$$postOwnerId"] } // To whome i followed
                                    ]
                                }
                            }
                        },
                        { $limit: 1 }
                    ],
                    as: "followDoc"
                }
            },

            // Retrive likes and comments 
            {
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "postId",
                    as: "likes"
                }
            },
            {
                $lookup: {
                    from: "comments",
                    localField: "_id",
                    foreignField: "postId",
                    as: "comments"
                }
            },

            // Check if saved by current user
            {
                $lookup: {
                    from: "saves",
                    let: { postId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$postId", "$$postId"] },
                                        { $eq: ["$userId", userId] }
                                    ]
                                }
                            }
                        },
                        { $limit: 1 }
                    ],
                    as: "savedDoc"
                }
            },

            // Check if liked by current user
            {
                $lookup: {
                    from: "likes",
                    let: { postId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$postId", "$$postId"] },
                                        { $eq: ["$userId", userId] }
                                    ]
                                }
                            }
                        },
                        { $limit: 1 }
                    ],
                    as: "likedDoc"
                }
            },

            // Add counts and isSaved flag
            {
                $addFields: {
                    likes_count: { $size: "$likes" },
                    comments_count: { $size: "$comments" },
                    isSaved: { $gt: [{ $size: "$savedDoc" }, 0] },
                    isLiked: { $gt: [{ $size: "$likedDoc" }, 0] },
                    isFollowing: { $gt: [{ $size: "$followDoc" }, 0] }
                }
            },

            // Cleanup
            { $project: { likes: 0, comments: 0, savedDoc: 0, likedDoc: 0, followDoc: 0 } }
        ]);

        // Handle next cursor
        let nextCursor = null;
        if (posts.length > parsedLimit) {
            nextCursor = posts[parsedLimit]._id;
            posts.pop(); // remove extra one
        }

        res.status(200).json({ posts, nextCursor, hasNextPage: Boolean(nextCursor) });

    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get post by user (on profile page)
export const getPostsByUser = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });
        let myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Destruct data
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        let posts, totalPosts;

        // Perform queries
        if (userId === "me") {
            totalPosts = await postsModel.countDocuments({ userId: myId, draft: false, suspended: false });
            posts = await postsModel.aggregate([
                { $match: { userId: myId, draft: false, suspended: false } },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },

                // join with users
                {
                    $lookup: {
                        from: "users",
                        let: { userId: "$userId" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                            { $project: { username: 1, avatar: 1, profile_name: 1 } }
                        ],
                        as: "user"
                    }
                },

                // Retrive likes and comments 
                {
                    $lookup: {
                        from: "likes",
                        localField: "_id",
                        foreignField: "postId",
                        as: "likes"
                    }
                },
                {
                    $lookup: {
                        from: "comments",
                        localField: "_id",
                        foreignField: "postId",
                        as: "comments"
                    }
                },

                // Check if liked by current user
                {
                    $lookup: {
                        from: "likes",
                        let: { postId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$postId", "$$postId"] },
                                            { $eq: ["$userId", myId] }
                                        ]
                                    }
                                }
                            },
                            { $limit: 1 }
                        ],
                        as: "likedDoc"
                    }
                },

                // Add counts and isSaved flag
                {
                    $addFields: {
                        likes_count: { $size: "$likes" },
                        comments_count: { $size: "$comments" },
                        isLiked: { $gt: [{ $size: "$likedDoc" }, 0] },
                    }
                },

                // Cleanup
                { $project: { likes: 0, comments: 0, likedDoc: 0 } }
            ]);

        } else {
            if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "Invalid user ID" });

            const otherUserId = mongoose.Types.ObjectId.createFromHexString(userId);

            totalPosts = await postsModel.countDocuments({ userId: otherUserId, draft: false, hide_post: false, suspended: false });
            posts = await postsModel.aggregate([
                { $match: { userId: otherUserId, draft: false, hide_post: false, suspended: false } },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },

                // join with users
                {
                    $lookup: {
                        from: "users",
                        let: { userId: "$userId" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                            { $project: { username: 1, avatar: 1, profile_name: 1 } }
                        ],
                        as: "user"
                    }
                },

                // Retrive likes and comments 
                {
                    $lookup: {
                        from: "likes",
                        localField: "_id",
                        foreignField: "postId",
                        as: "likes"
                    }
                },
                {
                    $lookup: {
                        from: "comments",
                        localField: "_id",
                        foreignField: "postId",
                        as: "comments"
                    }
                },

                // Check if liked by current user
                {
                    $lookup: {
                        from: "likes",
                        let: { postId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$postId", "$$postId"] },
                                            { $eq: ["$userId", myId] }
                                        ]
                                    }
                                }
                            },
                            { $limit: 1 }
                        ],
                        as: "likedDoc"
                    }
                },

                // Add counts and isSaved flag
                {
                    $addFields: {
                        likes_count: { $size: "$likes" },
                        comments_count: { $size: "$comments" },
                        isLiked: { $gt: [{ $size: "$likedDoc" }, 0] }
                    }
                },

                // Cleanup
                { $project: { likes: 0, comments: 0, likedDoc: 0} }
            ]);
        }

        res.status(200).json({ posts, currentPage: page, totalPages: Math.ceil(totalPosts / limit) });

    } catch (error) {
        console.error("Error fetching posts by user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get a specific post
export const getSpecificPost = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });
        let userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        const postId = req.params.postId;
        if (!postId) return res.status(400).json({ error: "PostId is missing." });

        const post = await postsModel.aggregate([
            {
                $match: {
                    postId: postId,
                    draft: false,
                    hide_post: false,
                    suspended: false,
                }
            },
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$userId" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                        { $project: { username: 1, avatar: 1, profile_name: 1 } }
                    ],
                    as: "user"
                }
            },

            // Check if current user follows the post owner
            {
                $lookup: {
                    from: "follows",
                    let: { postOwnerId: "$userId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$follower", userId] },   // I followed
                                        { $eq: ["$following", "$$postOwnerId"] } // To whome i followed
                                    ]
                                }
                            }
                        },
                        { $limit: 1 }
                    ],
                    as: "followDoc"
                }
            },

            // Retrive likes and comments 
            {
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "postId",
                    as: "likes"
                }
            },
            {
                $lookup: {
                    from: "comments",
                    localField: "_id",
                    foreignField: "postId",
                    as: "comments"
                }
            },

            // Check if liked by current user
            {
                $lookup: {
                    from: "likes",
                    let: { postId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$postId", "$$postId"] },
                                        { $eq: ["$userId", userId] }
                                    ]
                                }
                            }
                        },
                        { $limit: 1 }
                    ],
                    as: "likedDoc"
                }
            },

            // Add counts and isSaved flag
            {
                $addFields: {
                    likes_count: { $size: "$likes" },
                    comments_count: { $size: "$comments" },
                    isLiked: { $gt: [{ $size: "$likedDoc" }, 0] },
                    isFollowing: { $gt: [{ $size: "$followDoc" }, 0] }
                }
            },

            // Cleanup
            { $project: { likes: 0, comments: 0, likedDoc: 0, followDoc: 0 } }
        ]);
        if (!post[0]) return res.status(404).json({ error: "Post not found" });

        res.status(200).json({ post: post[0] });

    } catch (error) {
        console.log("Error getting specific post due to server error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// Get saved posts
export const getSavedPosts = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing" });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token" });

        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // pagination query params
        let { page = 1, limit = 10 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        // fetch paginated saved posts
        const [saved, total] = await Promise.all([
            saveModel.find({ userId }).populate("postId").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            saveModel.countDocuments({ userId })
        ]);

        res.status(200).json({ success: true, saved, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });

    } catch (err) {
        console.log("Error getting saved posts:", err);
        res.status(500).json({ success: false, message: "Error fetching saved posts" });
    }
};

// Get tags
export const getTags = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Finding tags
        const search = req.query.search || '';
        const tags = await tagsModel.find({ name: new RegExp(`^${search}`, 'i') }).sort({ usageCount: -1 }).limit(10);

        res.status(200).json({ tags });

    } catch (error) {
        console.log("Error finding tags:", error);
        res.status(500).json({ error: "Error finding tags due to server error." });
    }
}

// Increment share count
export const incrementShare = async (req, res) => {
    try {
        const { postId } = req.params;

        const post = await postsModel.findOneAndUpdate(
            { postId },
            { $inc: { share_count: 1 } },
            { new: true }
        );

        if (!post) return res.status(404).json({ error: "Post not found" });

        res.status(200).json({ success: true, share_count: post.share_count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Server error" });
    }
};

// Get draft posts
export const getDraftPosts = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Convert string ID to ObjectId
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Find drafts
        const drafts = await postsModel
            .find({ userId, draft: true })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await postsModel.countDocuments({ userId, draft: true });

        res.status(200).json({ drafts, page, totalPages: Math.ceil(total / limit), totalDrafts: total, });
    } catch (error) {
        console.error("Error fetching draft posts:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Publish a draft
export const publishDraft = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Convert string ID to ObjectId
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const { postId } = req.params;

        // Find the post
        const post = await postsModel.findOne({ postId, userId });
        if (!post) return res.status(404).json({ message: "Draft not found" });
        if (!post.draft) return res.status(400).json({ message: "Post is already published" });

        // Update draft -> false
        post.draft = false;
        await post.save();

        // Create activity
        await activityModel.create({ actor: userId, recipient: userId, targetPost: post._id, type: "post_created", message: "Created a new post" });

        res.json({ message: "Draft published successfully", post });
    } catch (error) {
        console.error("Error publishing draft:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete post
export const deletePost = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Convert string ID to ObjectId
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        let { postId } = req.params;
        if (!postId) return res.status(400).json({ error: "Post ID is required" });
        postId = mongoose.Types.ObjectId.createFromHexString(postId);

        // Find post
        const post = await postsModel.findOne({ _id: postId, userId });
        if (!post) return res.status(404).json({ error: "Post not found or unauthorized" });

        // Delete images if hosted on Cloudinary
        if (post.images && post.images.length > 0) {
            const imagePublicIds = post.images.filter(url => url.includes("cloudinary")).map(url => extractPublicId(url));

            if (imagePublicIds.length > 0) {
                await cloudinary.api.delete_resources(imagePublicIds, { resource_type: "image" });
            }
        }

        // Delete video if hosted on Cloudinary
        if (post.video && post.video.includes("cloudinary")) {
            const videoPublicId = extractPublicId(post.video);
            if (videoPublicId) await cloudinary.uploader.destroy(videoPublicId, { resource_type: "video" });
        }

        // Delete related data
        await Promise.all([
            commentsModel.deleteMany({ postId }),
            likesModel.deleteMany({ postId }),
            saveModel.deleteMany({ postId }),
            activityModel.deleteMany({ targetPost: postId })
        ]);

        // Finally delete the post itself
        await postsModel.deleteOne({ _id: postId, userId });

        res.status(200).json({ message: "Post deleted successfully" });

    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Update post
export const updatePost = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Convert string ID to ObjectId
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        let { postId } = req.params;
        if (!postId) return res.status(400).json({ error: "Post ID is required" });
        postId = mongoose.Types.ObjectId.createFromHexString(postId);

        // Destruct data
        const { caption, tags, disable_comments, draft } = req.body;

        // Update post 
        const post = await postsModel.findOneAndUpdate(
            { _id: postId, userId },
            { $set: { caption: (caption || "").trim(), tags, disable_comments, draft } }
        );

        if (!post) return res.status(404).json({ error: "Post not found" });
        res.status(200).json({ message: "Post updated." });

    } catch (error) {
        console.error("Error updating post:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Toogle like
export const toggleLikePost = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Extracting data
        let { postId } = req.params;
        if (!postId) return res.status(400).json({ error: "Post ID is required." })
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        postId = mongoose.Types.ObjectId.createFromHexString(postId);

        // Toggle like
        const existingLike = await likesModel.findOne({ postId, userId });

        if (existingLike) {
            await likesModel.deleteOne({ _id: existingLike._id });

            // Delete the activity to prevent duplicate likes activity
            await activityModel.deleteOne({
                actor: userId,
                targetPost: postId,
                type: "like_post"
            });

            return res.status(200).json({ message: "Post unliked" });

        } else {
            await likesModel.create({ postId, userId });

            // Create activity (only if user is not the post owner)
            const post = await postsModel.findById(postId).select("userId");
            const commentorName = await userModel.findById(userId).select("username profile_name");

            if (post && post.userId.toString() !== userId.toString()) {
                await activityModel.create({
                    actor: userId,
                    recipient: post.userId,
                    targetPost: postId,
                    type: "like_post",
                    message: `${commentorName.profile_name || commentorName.username} liked your post`
                });
            }

            return res.status(201).json({ message: "Post liked" });
        }

    } catch (error) {
        console.error("Error toggling like on post:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Add comment
export const addComment = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Extracting data
        let { postId } = req.params;
        if (!postId) return res.status(200).json({ error: "Post ID is required." });

        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ error: "Comment cannot be empty" });

        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        postId = mongoose.Types.ObjectId.createFromHexString(postId);

        // Add comment
        const comment = await commentsModel.create({ postId, userId, text });

        // Find the post to get recipient (post owner)
        const post = await postsModel.findById(postId).select("userId");
        const commentorName = await userModel.findById(userId).select("username profile_name");

        if (post && post.userId.toString() !== userId.toString()) {
            await activityModel.create({
                actor: userId,
                recipient: post.userId,
                targetPost: postId,
                targetComment: comment._id,
                type: "comment_post",
                message: `${commentorName.profile_name || commentorName.username} commented on your post`
            });
        }

        res.status(201).json({ comment });

    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get comments
export const getCommentsPaginated = async (req, res) => {
    try {
        let { postId } = req.params;
        if (!postId) return res.status(400).json({ error: "Post Id is required." });
        postId = mongoose.Types.ObjectId.createFromHexString(postId);

        const limit = parseInt(req.query.limit) || 15;
        const cursor = req.query.cursor;

        // Query 
        let query = { postId };
        if (cursor) {
            query._id = { $lt: mongoose.Types.ObjectId.createFromHexString(cursor) };
        }

        const comments = await commentsModel
            .find(query)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .populate("userId", "username profile_name avatar")
            .lean();

        // Check has more
        const hasMore = comments.length > limit;
        if (hasMore) comments.pop();

        res.status(200).json({ comments, hasMore, nextCursor: hasMore ? comments[comments.length - 1]._id : null });

    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};









// Delete comment from post
export const deleteComment = async (req, res) => {
    try {

    } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get likes
export const getLikesPaginated = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Pagination
        const { postId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const likes = await likesModel.find({ postId }).populate("userId", "username profilePic").skip(skip).limit(limit).sort({ createdAt: -1 });
        const totalLikes = await likesModel.countDocuments({ postId });

        res.status(200).json({ totalPages: Math.ceil(totalLikes / limit), currentPage: page, likes });

    } catch (error) {
        console.error("Error fetching likes:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


