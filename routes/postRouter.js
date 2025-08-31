import { 
    addComment, createPost, deleteComment, 
    deletePost, getCommentsPaginated, 
    getDraftPosts, 
    getLikesPaginated, getPosts, 
    getPostsByUser, getSavedPosts, getSpecificPost, getTags, incrementShare, publishDraft, toggleLikePost, 
    updatePost 
} from "../controllers/postController.js";
import upload from "../middlewares/multer.js";
import express from "express";

const postRouter = express.Router();

// create post (handles images, video uploads)
postRouter.post(
    '/create',
    upload.fields([
        { name: 'images' },
        { name: 'video', maxCount: 1 },
    ]),
    createPost
);

// Get tags
postRouter.get('/get-tags', getTags);

// Get posts
postRouter.get('/', getPosts);
postRouter.get("/drafts", getDraftPosts);
postRouter.get('/:userId', getPostsByUser);
postRouter.get('/post/:postId', getSpecificPost);
postRouter.get("/:postId/saved-posts", getSavedPosts);

// Post handling
postRouter.patch('/:postId', updatePost);
postRouter.delete('/:postId', deletePost);
postRouter.patch("/:postId/publish", publishDraft);

// Handling likes and comments
postRouter.post('/:postId/like', toggleLikePost);
postRouter.post('/:postId/comment', addComment);
postRouter.get("/:postId/likes", getLikesPaginated);
postRouter.get("/:postId/comments", getCommentsPaginated);
postRouter.delete('/delete-comment', deleteComment);

// Increament share count
postRouter.post('/:postId/share', incrementShare);



// Export router
export default postRouter;