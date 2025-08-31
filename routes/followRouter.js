import express from "express";
import { getFollowers, getFollowing, toggleFollow } from "../controllers/followController.js";

const followRouter = express.Router();

// Routes
followRouter.post('/:id', toggleFollow);
followRouter.get('/:id/followers', getFollowers);
followRouter.get('/:id/following', getFollowing);


export default followRouter;
