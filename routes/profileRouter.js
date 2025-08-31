import express from "express";
import { getProfile, updateAvatar, updateProfile } from "../controllers/profileController.js";
import upload from "../middlewares/multer.js";

const profileRouter = express.Router();


// Update profile data
profileRouter.patch('/update-avatar', upload.single('avatar'), updateAvatar);
profileRouter.patch('/update-profile', updateProfile);
profileRouter.get('/:userId', getProfile);



// Export router
export default profileRouter;