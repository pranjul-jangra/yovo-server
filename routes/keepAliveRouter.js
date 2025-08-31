import express from "express";
import { keepAlive } from "../controllers/keepAliveController.js";

const keepAliveRouter = express.Router();

keepAliveRouter.get('/', keepAlive);

export default keepAliveRouter;
