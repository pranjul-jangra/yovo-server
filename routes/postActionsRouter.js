import express from "express";
import { hidePost, toggleSave, unhidePost } from "../controllers/postActionsController.js";

const postActionsRouter = express.Router();

// Save/Unsave post
postActionsRouter.post('/save', toggleSave);

// Hide/Unhide post
postActionsRouter.post('/hide/:postId', hidePost);
postActionsRouter.post('/unhide/:postId', unhidePost);


export default postActionsRouter;
