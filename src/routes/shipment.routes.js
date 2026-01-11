import express from 'express';
import { bookShipment, calculateRates } from '../controllers/shipment.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public/Auth hybrid - Controller handles checking req.user for optional saving
// We need a middleware that populates req.user if token is present, but doesnt fail if not.
// Let's create `optionalAuth` or just usage `verifyToken` but handle the public case separately?
// The prompt says "work for guest users and for authenticated users".
// Our verifyToken fails if no token. We need a "soft" verify.

// For now, let's implement a soft verify inline or use a new middleware.
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
        // Token invalid/expired - treat as guest? Or error?
        // Usually if they send a token they expect auth. But for simplicity let's treat as guest or log error.
        // Let's safe fail to guest to avoid blocking booking if token expired.
        console.log('Optional Auth: Invalid token, treating as guest');
    }
    next();
};



router.post('/book', optionalAuth, bookShipment);
router.post('/rates', calculateRates);

export default router;
