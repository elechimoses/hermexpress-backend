import express from 'express';

import { upload } from '../middleware/upload.middleware.js';
import { completeProfile, getProfile, updateProfile } from '../controllers/profile.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';


const router = express.Router();

// Profile Management
router.post('/complete-profile', verifyToken, upload.single('id_card'), completeProfile);
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, upload.single('avatar'), updateProfile);

// Address Management
import { saveAddress, getAddresses } from '../controllers/address.controller.js';
router.post('/addresses', verifyToken, saveAddress);
router.get('/addresses', verifyToken, getAddresses);

export default router;