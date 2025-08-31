import express from 'express';
import { authLimiter } from '../middlewares/rateLimiting.js';
import { 
    changePassword, deleteAccount, 
    disableAccount, 
    resetPassword, 
    sendAccountDeletionOTP, sendEmailUpdationLink, 
    sendPasswordResetLink, 
    toggleAccountMode, 
    updateEmail 
} from '../controllers/accountController.js';

const accountRouter = express.Router();

// Email updation
accountRouter.post('/send-email-updation-link', authLimiter, sendEmailUpdationLink);
accountRouter.post('/update-email', authLimiter, updateEmail);

// Change password
accountRouter.post('/change-password', authLimiter, changePassword);

// Reset password
accountRouter.post('/send-password-reset-link', authLimiter, sendPasswordResetLink);
accountRouter.post('/reset-password', authLimiter, resetPassword);

// Send account deletion OTP
accountRouter.post('/send-account-deletion-otp', authLimiter, sendAccountDeletionOTP);
accountRouter.post('/delete-account', authLimiter, deleteAccount);

// Disable account
accountRouter.post('/disable-account', authLimiter, disableAccount);

// Toggle account mode
accountRouter.post('/switch-account', authLimiter, toggleAccountMode);


export default accountRouter;