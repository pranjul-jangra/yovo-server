import express from "express";
import { getActivities } from "../controllers/activityController.js";

const activityRouter = express.Router();

activityRouter.get('/', getActivities);


export default activityRouter;