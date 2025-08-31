import userModel from "../models/userSchema.js";
import admin from "../utils/firebaseUtils.js";
import bcrypt from "bcryptjs";
import { generateTokens, getDeviceInfo, getLocationInfo, verifyAccessToken, verifyRefreshToken } from "../utils/userUtils.js";
import mongoose from "mongoose";
import { Mail } from "../utils/mail.js";
import { feedbackFormTemplate } from "../utils/mailTemplates.js";


// New signup
export const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) { return res.status(401).json({ error: "All fields are required" }) }

        // Check if user already exists
        const existingUser = await userModel.findOne({ $or: [{ username }, { email }] });
        if (existingUser) { return res.status(409).json({ error: "Username or email already exists" }) }

        // Get device and location information
        const deviceInfo = getDeviceInfo(req.headers['user-agent']);
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
        const locationInfo = await getLocationInfo(ip);

        // Hash the password & create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await userModel.create({ username, email, password: hashedPassword })

        // generate tokens & hash refresh token
        const { accessToken, refreshToken } = generateTokens(newUser?._id);
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

        // Save session
        newUser.sessions = [
            {
                refreshToken: hashedRefreshToken,
                device: deviceInfo,
                location: locationInfo
            }
        ]
        await newUser.save();

        // Set cookie
        const isProduction = process.env.NODE_ENV === "production";
        res.cookie("refreshToken", refreshToken, { httpOnly: true, sameSite: isProduction ? "None" : "Lax", secure: isProduction, maxAge: 15 * 24 * 60 * 60 * 1000 });
        res.status(201).json({ message: "User registered successfully", accessToken });

    } catch (error) {
        console.log("Error registering user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// Login
export const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || username.trim() === '') return res.status(400).json({ error: "Username is required" });
        if (!password) return res.status(400).json({ error: "Password is required" });

        const user = await userModel.findOne({ username }).select("+password");
        if (!user) return res.status(404).json({ error: "User not found" });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ error: "Invalid password" });

        // Generate tokens & hash refresh token
        const { accessToken, refreshToken } = generateTokens(user._id);
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

        // Get device and location information
        const deviceInfo = getDeviceInfo(req.headers['user-agent']);
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
        const locationInfo = await getLocationInfo(ip);

        // Add new session info
        user.sessions.push({
            refreshToken: hashedRefreshToken,
            device: deviceInfo,
            location: locationInfo,
        });
        user.is_account_disabled = false;
        await user.save();

        const isProduction = process.env.NODE_ENV === "production";
        res.cookie("refreshToken", refreshToken, { httpOnly: true, sameSite: isProduction ? "None" : "Lax", secure: isProduction, maxAge: 15 * 24 * 60 * 60 * 1000 });
        res.status(200).json({ message: 'User logged in successfully', accessToken });

    } catch (error) {
        console.log("Error logging in user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// Login with firebase providers
export const loginWithFirebaseProvider = async (req, res) => {
    try {
        const { idToken } = req.body;
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { email, picture } = decodedToken;
        const name = decodedToken.name || email.split('@')[0] || 'user';

        // Get device & location info
        const deviceInfo = getDeviceInfo(req.headers['user-agent']);
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
        const locationInfo = await getLocationInfo(ip);

        // If user exists, push new session and return tokens
        let user = await userModel.findOne({ email });
        if (user) {
            const { accessToken, refreshToken } = generateTokens(user._id);
            const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

            user.sessions.push({
                refreshToken: hashedRefreshToken,
                device: deviceInfo,
                location: locationInfo
            });
            user.is_account_disabled = false;
            await user.save();

            const isProduction = process.env.NODE_ENV === "production";
            res.cookie("refreshToken", refreshToken, { httpOnly: true, sameSite: isProduction ? "None" : "Lax", secure: isProduction, maxAge: 15 * 24 * 60 * 60 * 1000 });
            return res.status(200).json({ message: "Logged in successfully", accessToken });
        }

        // Ensure unique username if user is new
        const existingUsername = await userModel.findOne({ username: name });
        const finalUsername = existingUsername ? `${name}_${Math.floor(Math.random() * 10000)}` : name;

        // Create new user & generate tokens
        const newUser = await userModel.create({
            username: finalUsername,
            email,
            avatar: picture || null,
        })

        const { accessToken, refreshToken } = generateTokens(newUser?._id);
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

        // Create a session
        newUser.sessions = [{
            refreshToken: hashedRefreshToken,
            device: deviceInfo,
            location: locationInfo
        }];
        await newUser.save();

        const secure = process.env.NODE_ENV === "production";
        res.cookie("refreshToken", refreshToken, { httpOnly: true, sameSite: secure ? "None" : "Lax", secure, maxAge: 15 * 24 * 60 * 60 * 1000 });
        res.status(201).json({ message: "User logged in successfully", accessToken });

    } catch (err) {
        console.error("Firebase provider login error:", err);
        res.status(401).json({ error: "Invalid ID token" });
    }
};

// Refresh access token
export const refreshTokens = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) return res.status(401).json({ error: "Unauthorized. Session has expired." });
        const decoded = await verifyRefreshToken(refreshToken);
        if (!decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid session." });

        // Find user
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found." });

        // Find index of previous token
        const matchedIndex = await Promise.all(user.sessions.map(s => bcrypt.compare(refreshToken, s.refreshToken)))
            .then(matches => matches.findIndex(m => m));

        if (matchedIndex === -1) return res.status(401).json({ error: "Unauthorized. Invalid session." });

        // Rotate tokens
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
        const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);

        // Update session in place
        user.sessions[matchedIndex].refreshToken = hashedRefreshToken;
        await user.save();

        // Set cookie
        const isProduction = process.env.NODE_ENV === "production";
        res.cookie("refreshToken", newRefreshToken, { httpOnly: true, sameSite: isProduction ? "None" : "Lax", secure: isProduction, maxAge: 15 * 24 * 60 * 60 * 1000 });
        res.status(200).json({ message: "Token refreshed", accessToken });

    } catch (error) {
        console.log("Error refreshing access token:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Logout user
export const logoutUser = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;
        if (!refreshToken) return res.status(400).json({ error: "Refresh token not found" });

        const decoded = await verifyRefreshToken(refreshToken);
        if (!decoded.id) return res.status(401).json({ error: "Unathorized access. Invalid token." });

        // Find user
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Filter out the session matching the current hashed refreshToken
        user.sessions = user.sessions.filter(session => {
            return !bcrypt.compareSync(refreshToken, session.refreshToken);
        });
        await user.save();

        res.clearCookie("refreshToken");
        res.status(200).json({ message: "Logged out successfully" });

    } catch (error) {
        if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
            return res.status(401).json({ error: "Unauthorized access" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};

// Logout from all devices
export const logoutAllSessions = async (req, res) => {
    try {
        const token = req.headers?.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ error: "Token not found" });
        const decoded = await verifyAccessToken(token);
        if (!decoded.id) return res.status(401).json({ error: "Unauthorized access. Invalid token." });

        // Find user
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const user = await userModel.findById(userId).select("+password");
        if (!user) return res.status(404).json({ error: "User not found" });

        // Verify password
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: "Password is required" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect password" });

        // Clear all sessions
        user.sessions = [];
        await user.save();

        res.clearCookie("refreshToken");
        res.status(200).json({ message: "Logged out of all devices." });

    } catch (error) {
        console.log("Error clearing session:", error);
        if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
            return res.status(401).json({ error: "Unauthorised access" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};

// Logout of other devices
export const logoutOtherSessions = async (req, res) => {
    try {
        const token = req.headers?.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ error: "Token not found" });
        const decoded = await verifyAccessToken(token);
        if (!decoded.id) return res.status(401).json({ error: "Unauthorized access. Invalid token." });

        // Find user
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
        const user = await userModel.findById(userId).select('+password');
        if (!user) return res.status(404).json({ error: "User not found" });

        // Verify password
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: "Password is required" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect password" });

        // Filter out the current session
        const { refreshToken } = req.cookies;
        if (!refreshToken) return res.status(400).json({ error: "Refresh token not found" });

        // Find the session that matches the hashed refresh token
        let currentSession;
        for (const session of user.sessions) {
            const match = await bcrypt.compare(refreshToken, session.refreshToken);
            if (match) {
                currentSession = session;
                break;
            }
        }

        if (!currentSession) return res.status(401).json({ error: "Current session not found or already expired" });

        user.sessions = [currentSession];
        await user.save();

        res.status(200).json({ message: "Logged out of all devices.", currentSession });

    } catch (error) {
        console.log("Error logging out other sessions:", error);
        if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
            return res.status(401).json({ error: "Unauthorised access" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
}

// Send feedback
export const sendFeedback = async (req, res) => {
    try {
        const accessToken = req.headers?.authorization?.split(" ")?.[1];
        if (!accessToken) return res.status(401).json({ error: "Unauthorized. Token is missing." });
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded || !decoded.id) return res.status(401).json({ error: "Unauthorized. Invalid token." });

        // Convert string ID to ObjectId
        const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

        const { name, email, category = "general feedback", subject, message } = req.body;
        if (!name || !email || !subject || !message) return res.status(400).json({ error: "Please provide the value for missing fields." })

        // Find the user and match the user
        const user = await userModel.findById(userId);
        if (user.email !== email) return res.status(400).json({ error: "You are not registered with the provided email." });

        // Send mail
        await Mail({
            email: "stackmailer68@gmail.com",
            subject: "User query received through feedback form <Yovo>",
            html: feedbackFormTemplate(name, email, category, subject, message),
        });

        res.status(200).json({ message: "Feedback submitted" });

    } catch (error) {
        console.log("Error sending feedback due to server error.");
        res.status(500).json({ error: "Error sending feedback due to server error" });
    }
}
