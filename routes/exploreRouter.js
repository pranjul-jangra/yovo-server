import express from "express";
import { 
    getExploreInitial, getExplorePosts, 
    getExploreUsers, 
    getPostsByTag,
    searchExplore,
    searchExploreMore,
    searchExplorePreview
} from "../controllers/exploreController.js";

const exploreRouter = express.Router();

// Explore feed
exploreRouter.get("/", getExploreInitial);

// Explore posts (pagination)
exploreRouter.get("/posts", getExplorePosts);

// Explore users (pagination)
exploreRouter.get("/users", getExploreUsers);

// Explore posts by tag (pagination)
exploreRouter.get("/tag/post/:tag", getPostsByTag);

// Search
exploreRouter.get("/search", searchExplore);

// Search preview (instant suggestions)
exploreRouter.get("/search/preview", searchExplorePreview);

// Search more (paginated results for search)
exploreRouter.get("/search/more", searchExploreMore);


export default exploreRouter;