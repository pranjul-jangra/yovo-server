import express from "express";
import { expireOlderReports, unsuspendJob } from "../controllers/cronController.js";

const cronRouter = express.Router();


cronRouter.get('/unsuspend', unsuspendJob);
cronRouter.post('/expire-reports', expireOlderReports);


export default cronRouter;