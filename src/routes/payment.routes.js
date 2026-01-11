import express from 'express';
import { getPaymentMethods, initializeTransaction, handlePaymentCallback } from '../controllers/payment.controller.js';

const router = express.Router();
router.get('/callback/:provider', handlePaymentCallback);
router.get('/', getPaymentMethods);
router.post('/initialize', initializeTransaction);


export default router;
