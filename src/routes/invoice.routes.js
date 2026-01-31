import express from 'express';
import { createInvoice, getInvoices } from '../controllers/invoice.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { verifyAdmin } from '../middleware/admin.middleware.js';

const router = express.Router();

router.use(verifyToken);

// Admin only
router.post('/create', verifyAdmin, createInvoice);

// User/Admin Get Invoices
router.get('/invoices', getInvoices);

export default router;
