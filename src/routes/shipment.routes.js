import express from 'express';
import { 
    bookShipment, 
    calculateRates,
    getUserRecentShipments,
    getUserPendingShipmentCount,
    getUserTotalShipmentCount,
    trackShipment
} from '../controllers/shipment.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// ... existing optionalAuth ...
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

const optionalAuth = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
        const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        if (userRes.rows.length > 0) {
            req.user = userRes.rows[0];
        }
    } catch (err) {
        console.log('Optional Auth: Invalid token, treating as guest');
    }
    next();
};

router.post('/book', optionalAuth, bookShipment);
router.post('/rates', optionalAuth, calculateRates);
router.get('/track/:trackingNumber', trackShipment);

// User Dashboard Routes (Protected)
router.get('/user/recent', verifyToken, getUserRecentShipments);
router.get('/user/pending', verifyToken, getUserPendingShipmentCount);
router.get('/user/total', verifyToken, getUserTotalShipmentCount);

export default router;
