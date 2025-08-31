import express from "express";
import { createReport } from "../controllers/reportController.js";

const reportRouter = express.Router();


reportRouter.post('/', createReport);


export default reportRouter;