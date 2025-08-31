import mongoose from "mongoose";
import { verifyAccessToken } from "../utils/userUtils.js";
import tokenModel from "../models/tokenSchema.js";
import jwt from 'jsonwebtoken';
import bcrypt from "bcryptjs";
import { Mail } from "../utils/mail.js";
import { accountDeletionTemplate, emailUpdationTemplate, passwordResetTemplate } from "../utils/mailTemplates.js";
import userModel from "../models/userSchema.js";
import { extractPublicId } from "../utils/extractPublicId.js";
import { cloudinary } from "../middlewares/multer.js";
import postsModel from "../models/postsSchema.js";
import activityModel from "../models/ActivitySchema.js";
import commentsModel from "../models/commentsSchema.js";
import likesModel from "../models/likesSchema.js";
import saveModel from "../models/saveSchema.js";
import followModel from "../models/followSchema.js";
import reportModel from "../models/reportModel.js";
import conversationModel from "../models/conversationSchema.js";
import messageModel from "../models/messageSchema.js";


// Change email (Send link)
export const sendEmailUpdationLink = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing" });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded) return res.status(401).json({ error: "Unauthorized. Invalid token" });

        // Invalidate the previous token (Link) if exists
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const { email } = req.body;
        if (!email || !email.trim()) return res.status(400).json({ error: "Email is required" });
        await tokenModel.deleteOne({ userId, type: "emailUpdation" });

        // Generate & hash verification link & create link
        const emailUpdationToken = await jwt.sign({ id: decoded.id }, process.env.EMAIL_TOKEN_SECRET, { expiresIn: "15m" });
        const hashedToken = await bcrypt.hash(emailUpdationToken, 10);
        const link = `${process.env.FRONTEND_URL}/settings/update-email?token=${emailUpdationToken}`;

        // Send mail
        await Mail({
            email,
            subject: "Email Updation Request",
            html: emailUpdationTemplate(link)
        })

        // Store the token
        await tokenModel.create({ userId: decoded.id, type: "emailUpdation", token: hashedToken });
        res.status(201).json({ message: "Link sent" });

    } catch (error) {
        console.log("Error sending email updation link:", error);
        res.status(500).json({ error: "Error sending mail (email updation link) due to server error" });
    }
}

// Change email (Verify link & update email)
export const updateEmail = async (req, res) => {
    try {
        const { token, newEmail } = req.body;
        if (!token) return res.status(400).json({ error: "Token is missing." });
        if (!newEmail) return res.status(400).json({ error: "New email is required" });

        // Verify token
        const decoded = await jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);
        if (!decoded || !decoded.id) return res.status(400).json({ error: "Invalid token or the link has expired." });
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Find token and match
        const existingToken = await tokenModel.findOne({ userId, type: "emailUpdation" });
        if (!existingToken) return res.status(400).json({ error: "Link has expired." });

        const isSame = await bcrypt.compare(token, existingToken.token);
        if (!isSame) return res.status(400).json({ error: "Invalid token." });

        // Validate email uniqueness and update
        const isEmailExists = await userModel.findOne({ email: newEmail });
        if (isEmailExists) return res.status(409).json({ error: "Email already in use." });

        await userModel.findByIdAndUpdate(userId, { $set: { email: newEmail } });
        await tokenModel.deleteOne({ userId, type: "emailUpdation" });
        res.status(200).json({ message: "Email updated" });

    } catch (error) {
        console.log("Error updating email:", error);
        res.status(500).json({ error: "Error updating email due to server error" });
    }
}

// Change password
export const changePassword = async (req, res) => {
    try {
        const { password, newPassword } = req.body;
        if (!password || !newPassword) return res.status(400).json({ error: "Password and new password are required" });

        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing" });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token" });

        // Find user
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const user = await userModel.findById(userId).select("+password");
        if (!user) return res.status(404).json({ error: "User not found" });

        // Verify password
        const isVerified = await bcrypt.compare(password, user.password);
        if (!isVerified) return res.status(400).json({ error: "Invalid password" });
        if (password === newPassword) return res.status(400).json({ error: "You can't use your current password" });

        // Hash password and update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password updated" });

    } catch (error) {
        console.log("Error changing password:", error);
        res.status(500).json({ error: "Error changing password due to server error" });
    }
}

// Forgot password (Send link)
export const sendPasswordResetLink = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email.trim()) return res.status(400).json({ error: "Email is required" });

        // Invalidate old token
        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ error: "No user associated with this email" });
        await tokenModel.deleteOne({ userId: user._id, type: "passwordReset" });

        // Generate & hash verification link & create link
        const passwordResetToken = await jwt.sign({ id: user._id }, process.env.PASSWORD_TOKEN_SECRET, { expiresIn: "15m" });
        const hashedToken = await bcrypt.hash(passwordResetToken, 10);
        const link = `${process.env.FRONTEND_URL}/settings/reset-password?token=${passwordResetToken}`;

        // send mail
        await Mail({
            email,
            subject: "Password Reset Request",
            html: passwordResetTemplate(link)
        });

        // Store token
        await tokenModel.create({ userId: user._id, type: "passwordReset", token: hashedToken });
        res.status(201).json({ message: "Link sent" });

    } catch (error) {
        console.log("Error sending password reset link:", error);
        res.status(500).json({ error: "Error sending mail (password reset link) due to server error" });
    }
}

// Forgot password (Verify link & update password)
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token) return res.status(401).json({ error: "Token is missing." });
        if (!newPassword) return res.status(400).json({ error: "New password is required" });

        // Verify token
        const decoded = await jwt.verify(token, process.env.PASSWORD_TOKEN_SECRET);
        if (!decoded || !decoded.id) return res.status(400).json({ error: "Invalid token or the link has expired." });
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Find token
        const existingToken = await tokenModel.findOne({ userId, type: "passwordReset" });
        if (!existingToken) return res.status(400).json({ error: "Link has expired." });

        // Compare token
        const isSame = await bcrypt.compare(token, existingToken.token);
        if (!isSame) return res.status(400).json({ error: "Invalid token." });

        // Find user & validate password uniqueness
        const user = await userModel.findById(userId).select("+password");
        if (!user) return res.status(404).json({ error: "User not found" });

        const isPasswordSame = await bcrypt.compare(newPassword, user.password);
        if (isPasswordSame) return res.status(409).json({ error: "You can't use your current password" });

        // Hash the password & update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        await tokenModel.deleteOne({ userId, type: "passwordReset" });

        res.status(200).json({ message: "Password updated" });

    } catch (error) {
        console.log("Error reseting password:", error);
        res.status(500).json({ error: "Error reseting password due to server error" });
    }
}

// Delete account (send OTP)
export const sendAccountDeletionOTP = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing" });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Invalidate previous token if exists
        await tokenModel.deleteOne({ userId, type: "otp" });

        // Generate 6 digit otp & create hash
        const otp = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
        const hashedOTP = await bcrypt.hash(otp.toString(), 10);

        // Send mail
        await Mail({
            email,
            subject: "Account Deletion Request",
            html: accountDeletionTemplate(otp)
        });

        // Store otp
        await tokenModel.create({ userId, type: "otp", otp: hashedOTP });
        res.status(201).json({ message: "OTP sent" });

    } catch (error) {
        console.log("Error generating account deletion OTP:", error);
        res.status(500).json({ error: "Error generating OTP due to server error" });
    }
}

// Delete account (Verify OTP & Delete account)
export const deleteAccount = async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) return res.status(400).json({ error: "OTP is required" });

        // Verify user
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        // Find otp
        const storedOTP = await tokenModel.findOne({ userId, type: "otp" });
        if (!storedOTP) return res.status(404).json({ error: "OTP has expired." });

        // Compare OTP
        const isValid = await bcrypt.compare(otp, storedOTP.otp);
        if (!isValid) return res.status(400).json({ error: "Invalid or expired OTP" });

        // Find user
        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // =============== Collect Cloudinary public_ids ===============
        let imageIds = [];
        let videoIds = [];

        // Avatar
        if (user.avatar && user.avatar.includes("cloudinary")) {
            const profilePublicId = extractPublicId(user.avatar);
            if (profilePublicId) imageIds.push(profilePublicId);
        }

        // Posts media
        const userPosts = await postsModel.find({ userId });
        userPosts.forEach(post => {
            // Images
            if (post.images && post.images.length > 0) {
                post.images.forEach(url => {
                    const pid = extractPublicId(url);
                    if (pid) imageIds.push(pid);
                });
            }
            // Video
            if (post.video) {
                const pid = extractPublicId(post.video);
                if (pid) videoIds.push(pid);
            }
        });

        // ================= Delete media in batches of 100 =================
        const chunkSize = 100;

        for (let i = 0; i < imageIds.length; i += chunkSize) {
            const chunk = imageIds.slice(i, i + chunkSize);
            await cloudinary.api.delete_resources(chunk, { resource_type: "image" });
        }

        for (let i = 0; i < videoIds.length; i += chunkSize) {
            const chunk = videoIds.slice(i, i + chunkSize);
            await cloudinary.api.delete_resources(chunk, { resource_type: "video" });
        }

        // ================= DB Cleanups =================
        await Promise.all([
            activityModel.deleteMany({ $or: [{ actor: userId }, { recipient: userId }] }),
            commentsModel.deleteMany({ userId }),
            likesModel.deleteMany({ userId }),
            postsModel.deleteMany({ userId }),
            saveModel.deleteMany({ userId }),
            tokenModel.deleteMany({ userId }),
            followModel.deleteMany({ $or: [{ follower: userId }, { following: userId }] }),
            reportModel.updateMany({ reporterId: userId }, { $set: { reporterId: null } }),
            reportModel.deleteMany({ type: "user", targetId: userId }),
            messageModel.updateMany({ sender: userId }, { $set: { sender: null } }),
            messageModel.updateMany({ isReadBy: userId }, { $pull: { isReadBy: userId } })
        ]);

        // ================= Conversations =================
        const conversations = await conversationModel.find({ participants: userId });
        for (const convo of conversations) {
            convo.participants = convo.participants.filter(id => id.toString() !== userId.toString());
            convo.admins = convo.admins.filter((id) => id.toString() !== userId.toString());
            convo.hiddenBy = convo.hiddenBy.filter((id) => id.toString() !== userId.toString());
            convo.mutedBy = convo.mutedBy.filter((id) => id.toString() !== userId.toString());

            if (convo.participants.length === 0) {
                await convo.deleteOne();
            } else {
                await convo.save();
            }
        }

        // Delete user and cleanup the cookies
        await userModel.findByIdAndDelete(userId);
        res.clearCookie("refreshToken");

        res.status(200).json({ message: "Account deleted successfully." });

    } catch (error) {
        console.log("Error deleting account:", error);
        res.status(500).json({ error: "Error deleting account due to server error" });
    }
}

// Disable account
export const disableAccount = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing" });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const { password } = req.body;
        if (!password || !password.trim()) return res.status(400).json({ error: "Password is required." });

        // Find user & verify password
        const user = await userModel.findById(userId).select("+password");
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isVerified = await bcrypt.compare(password, user.password);
        if (!isVerified) return res.status(400).json({ error: "Invalid password" });

        // Disable account
        user.is_account_disabled = true;
        await user.save();

        res.clearCookie("refreshToken");
        res.status(200).json({ message: "Account disabled successfully." });

    } catch (error) {
        console.log("Error disabling account:", error);
        res.status(500).json({ error: "Error disabling account due to server error" });
    }
}

// Toggle account mode
export const toggleAccountMode = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing" });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const toggledValue = req.body?.toggledValue;
        if (toggledValue === undefined || toggledValue === null || toggledValue === "") {
            return res.status(400).json({ error: "Missing value." });
        }

        // Find user
        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found." });

        // Updating account mode
        const newValue = (toggledValue || toggledValue === 'true') ? true : false;
        user.is_account_private = newValue;
        await user.save();

        res.status(200).json({ message: 'Account mode updated.' });

    } catch (error) {
        console.log("Error toggling account mode:", error);
        res.status(500).json({ error: "Error toggling account mode due to server error" });
    }
}
