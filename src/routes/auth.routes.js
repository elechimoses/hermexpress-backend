import express from 'express';
import { register, verifyEmail, login, forgotPassword, resetPassword, resendVerificationCode } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
