import postsModel from "../models/postsSchema.js";
import tagsModel from "../models/tagsSchema.js";
import userModel from "../models/userSchema.js";
import mongoose from "mongoose";
import { verifyAccessToken } from "../utils/userUtils.js";

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Explore feed
export const getExploreInitial = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Destruct queries
        const { limitPosts = 10, limitTags = 10, limitUsers = 10 } = req.query;

        // Finding data
        const tags = await tagsModel.find().sort({ usageCount: -1 }).limit(Number(limitTags));

        const posts = await postsModel.find({ draft: false, hide_post: false, suspended: false, userId: { $ne: myId } })
            .sort({ createdAt: -1 })
            .limit(Number(limitPosts))
            .populate("userId", "username avatar profile_name");

        const users = await userModel.find({ is_account_disabled: false, suspended: false, _id: { $ne: myId } })
            .sort({ createdAt: -1 })
            .limit(Number(limitUsers))
            .select("username avatar profile_name");

        res.status(200).json({ tags, posts, users });

    } catch (error) {
        res.status(500).json({ message: "Error loading explore page", error });
    }
};

// Paginate posts
export const getExplorePosts = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Destruct queries
        const { cursor, limit = 10 } = req.query;

        let query = { draft: false, hide_post: false, suspended: false, userId: { $ne: myId } };
        if (cursor) query._id = { $lt: cursor };

        let posts = await postsModel.find(query)
            .sort({ _id: -1 })
            .limit(Number(limit) + 1)
            .populate("userId", "username avatar profile_name");

        let nextCursor = null;
        if (posts.length > limit) {
            nextCursor = posts[limit]._id;
            posts = posts.slice(0, limit);
        }

        res.status(200).json({ posts, nextCursor });

    } catch (error) {
        res.status(500).json({ message: "Error fetching explore posts", error });
    }
};

// Paginate users
export const getExploreUsers = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Destruct queries
        const { cursor, limit = 10 } = req.query;

        let query = { is_account_disabled: false, suspended: false, _id: { $ne: myId } };
        if (cursor) query._id = { $lt: cursor };

        let users = await userModel.find(query)
            .sort({ _id: -1 })
            .limit(Number(limit) + 1)
            .select("username avatar profile_name");

        let nextCursor = null;
        if (users.length > limit) {
            nextCursor = users[limit]._id;
            users = users.slice(0, limit);
        }

        res.status(200).json({ users, nextCursor });

    } catch (error) {
        res.status(500).json({ message: "Error fetching explore users", error });
    }
};

// Explore by Tag
export const getPostsByTag = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Destruct queries
        const { tag } = req.params;
        const { cursor, limit = 10 } = req.query;

        let query = { tags: tag, draft: false, hide_post: false, suspended: false };
        if (cursor) query._id = { $lt: cursor };

        let posts = await postsModel.find(query)
            .sort({ _id: -1 })
            .limit(Number(limit) + 1)
            .populate("userId", "username avatar profile_name");

        let nextCursor = null;
        if (posts.length > limit) {
            nextCursor = posts[limit]._id;
            posts = posts.slice(0, limit);
        }

        res.status(200).json({ posts, nextCursor });

    } catch (error) {
        res.status(500).json({ message: "Error fetching posts by tag", error });
    }
};

// Search (quick fetch of 10 each)
export const searchExplore = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Destruct queries
        const { query } = req.query;
        if (!query) return res.json({ users: [], tags: [], posts: [] });

        const regex = new RegExp(query, "i");

        const users = await userModel.find({ $or: [{ username: regex }, { profile_name: regex }, { bio: regex }], _id: { $ne: myId } })
            .select("username avatar profile_name")
            .limit(10)
            .lean();

        const tags = await tagsModel.find({ name: regex }).limit(10).lean();

        const posts = await postsModel.find({ caption: regex, draft: false, hide_post: false, suspended: false, userId: { $ne: myId } })
            .populate("userId", "username avatar")
            .limit(10)
            .lean();

        res.status(200).json({ users, tags, posts });

    } catch (error) {
        res.status(500).json({ message: "Error searching explore", error });
    }
};

// Small preview results (5 each) while typing
export const searchExplorePreview = async (req, res) => {
    try {
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Destruct queries
        const q = (req.query.q || "").trim();
        if (!q) return res.status(200).json({ users: [], posts: [], tags: [] });

        const regex = new RegExp(escapeRegex(q), "i");

        const [users, posts, tags] = await Promise.all([
            userModel
                .find({
                    is_account_disabled: false,
                    suspended: false,
                    _id: { $ne: myId },
                    $or: [{ username: regex }, { profile_name: regex }, { bio: regex }],
                })
                .select("username profile_name avatar bio")
                .sort({ _id: -1 })
                .limit(5)
                .lean(),

            postsModel
                .find({
                    draft: false,
                    hide_post: false,
                    suspended: false,
                    userId: { $ne: myId },
                    $or: [{ caption: regex }, { tags: regex }],
                })
                .select("images video caption tags userId postId likes_count comments_count")
                .populate("userId", "username profile_name avatar")
                .sort({ _id: -1 })
                .limit(5)
                .lean(),

            tagsModel
                .find({ name: regex })
                .select("name usageCount")
                .sort({ usageCount: -1, _id: -1 })
                .limit(7)
                .lean(),
        ]);

        res.status(200).json({ users, posts, tags });

    } catch (err) {
        console.error("searchExplorePreview error:", err);
        res.status(500).json({ message: "Failed to load search preview" });
    }
};

// Paginated search results
export const searchExploreMore = async (req, res) => {
    try {
        console.log("Request received.");
        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Desctruct queries
        const q = (req.query.q || "").trim();
        const type = (req.query.type || "posts").toLowerCase(); // users | posts | tags
        const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
        const cursor = req.query.cursor;
        const regex = q ? new RegExp(escapeRegex(q), "i") : null;
        if (!regex) return res.status(400).json({ type, items: [], nextCursor: null });

        let items = [];
        let nextCursor = null;

        if (type === "users") {
            const query = {
                is_account_disabled: false,
                suspended: false,
                $or: [{ username: regex }, { profile_name: regex }, { bio: regex }],
            };
            if (cursor) query._id = { $lt: mongoose.Types.ObjectId.createFromHexString(cursor) };

            items = await userModel
                .find(query)
                .select("username profile_name avatar bio")
                .sort({ _id: -1 })
                .limit(limit + 1);

        } else if (type === "tags") {
            const query = { name: regex };
            if (cursor) query._id = { $lt: mongoose.Types.ObjectId.createFromHexString(cursor) };

            items = await tagsModel
                .find(query)
                .select("name usageCount")
                .sort({ _id: -1 })
                .limit(limit + 1);

        } else {
            // posts
            const query = {
                draft: false,
                hide_post: false,
                suspended: false,
                $or: [{ caption: regex }, { tags: regex }],
            };
            if (cursor) query._id = { $lt: mongoose.Types.ObjectId.createFromHexString(cursor) };

            items = await postsModel
                .find(query)
                .select("images video caption tags userId likes_count comments_count")
                .populate("userId", "username avatar")
                .sort({ _id: -1 })
                .limit(limit + 1);
        }

        if (items.length > limit) {
            nextCursor = items[limit]._id;
            items = items.slice(0, limit);
        }

        res.status(200).json({ type, items, nextCursor });

    } catch (err) {
        console.error("searchExploreMore error:", err);
        res.status(500).json({ message: "Failed to load more search results" });
    }
};

