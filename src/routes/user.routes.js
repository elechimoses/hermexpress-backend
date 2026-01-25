import express from 'express';

import { upload } from '../middleware/upload.middleware.js';
import { completeProfile, getProfile, updateProfile } from '../controllers/profile.controller.js';
import { saveAddress, getAddresses } from '../controllers/address.controller.js';
import { getWallet, getTransactions, fundWallet } from '../controllers/wallet.controller.js';
import { getNotifications, markRead, markAllRead } from '../controllers/notification.controller.js';

const router = express.Router();

// Profile Management
router.post('/complete-profile', upload.single('id_card'), completeProfile);
router.get('/profile', getProfile);
router.put('/profile', upload.single('avatar'), updateProfile);

// Address Management

router.post('/addresses', saveAddress);
router.get('/addresses', getAddresses);


router.get('/wallet', getWallet);
router.get('/transactions', getTransactions);
router.post('/fund', fundWallet);

// Notifications
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markRead);
router.put('/notifications/read-all', markAllRead);

export default router;