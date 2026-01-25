import express from 'express';
import { getWallet, getTransactions, fundWallet } from '../controllers/wallet.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken); // All wallet routes require auth

router.get('/', getWallet);
router.get('/transactions', getTransactions);
router.post('/fund', fundWallet);

export default router;
