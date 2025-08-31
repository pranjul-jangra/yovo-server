import express from 'express';
import { 
    loginUser, 
    loginWithFirebaseProvider, logoutAllSessions, 
    logoutOtherSessions, 
    logoutUser, refreshTokens, registerUser,
    sendFeedback, 
} from '../controllers/authController.js';
import { authLimiter } from '../middlewares/rateLimiting.js';

const authRouter = express.Router();

// Login and signup routes
authRouter.post('/register', authLimiter, registerUser);
authRouter.post('/login', authLimiter, loginUser);
authRouter.post('/firebase-login', authLimiter, loginWithFirebaseProvider);

// Refresh access token
authRouter.get('/refresh-token', refreshTokens);

// Logout and Logout from all devices route
authRouter.post('/logout', logoutUser);
authRouter.post('/logout-all', authLimiter, logoutAllSessions);
authRouter.post('/logout-other-sessions', authLimiter, logoutOtherSessions);

// Send feedback 
authRouter.post('/submit-feedback', sendFeedback);


export default authRouter;