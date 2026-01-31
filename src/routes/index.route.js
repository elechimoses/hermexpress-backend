import express from 'express';


import authRouter from './auth.routes.js';
import quoteRouter from './quote.routes.js';
import adminRouter from './admin.routes.js';
import userRouter from './user.routes.js';
import shipmentRouter from './shipment.routes.js';
import paymentRouter from './payment.routes.js';
import categoryRouter from './category.routes.js';
import invoiceRouter from './invoice.routes.js';
import { submitContactForm } from '../controllers/contact.controller.js';

import { verifyToken } from '../middleware/auth.middleware.js';


const router = express.Router();



router.use('/api/auth', authRouter);
router.use('/api', quoteRouter);
router.use('/api/shipments', shipmentRouter);
router.use('/api/payment', paymentRouter);
router.use('/api/categories', categoryRouter);
router.use('/api/contact', submitContactForm);

router.use('/api/invoices', verifyToken, invoiceRouter);

//private routes
router.use('/api/user', verifyToken, userRouter);
router.use('/api/admin', verifyToken, adminRouter);

export default router;



