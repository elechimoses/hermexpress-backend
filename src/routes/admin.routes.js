import express from 'express';
const router = express.Router();
import { verifyToken } from '../middleware/auth.middleware.js';
import { verifyAdmin } from '../middleware/admin.middleware.js';
import * as adminController from '../controllers/admin.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import * as insuranceController from '../controllers/insurance.controller.js';
import * as categoryController from '../controllers/category.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import * as shipmentController from '../controllers/shipment.controller.js';
import * as invoiceController from '../controllers/invoice.controller.js';
import { upload } from '../middleware/upload.middleware.js';

// Apply middleware to all admin routes
router.use(verifyToken, verifyAdmin);

// Settings
router.get('/settings', adminController.getSettings);
router.patch('/settings', adminController.updateSetting);

// Countries
router.post('/countries', adminController.createCountry);
router.put('/countries/:id', adminController.updateCountry);
router.get('/countries', adminController.getCountries);

// Cities
router.post('/cities', adminController.createCity);
router.put('/cities/:id', adminController.updateCity);
router.get('/cities', adminController.getCities);

// Options
router.post('/options', adminController.createOption);
router.put('/options/:id', adminController.updateOption);
router.get('/options', adminController.getOptions);

// Rates
router.post('/rates', adminController.createRate);
router.put('/rates/:id', adminController.updateRate);
router.delete('/rates/:id', adminController.deleteRate);
router.get('/rates', adminController.getRates);

// Payment Methods
router.get('/payment-methods', paymentController.getAllPaymentMethods);
router.post('/payment-methods', upload.single('image'), paymentController.addPaymentMethods);
router.put('/payment-methods/:id', upload.single('image'), paymentController.updatePaymentMethod);

// Insurance Policies
router.post('/insurance-policies', insuranceController.createInsurancePolicy);
router.put('/insurance-policies/:id', insuranceController.updateInsurancePolicy);
router.delete('/insurance-policies/:id', insuranceController.deleteInsurancePolicy);
router.get('/insurance-policies', insuranceController.getInsurancePolicies);


router.post('/categories', categoryController.createCategory);

// Wallets

router.post('/wallets/update', walletController.adminUpdateWallet);

router.post('/invoices/create', invoiceController.createInvoice);
router.get('/invoices', invoiceController.getInvoices);

// Shipments (Admin Dashboard)

router.get('/shipments/recent', shipmentController.getAdminRecentShipments);
router.get('/shipments/pending-count', shipmentController.getAdminPendingShipmentCount);
router.get('/shipments/total-count', shipmentController.getAdminTotalShipmentCount);
router.get('/shipments/:id', shipmentController.getShipmentDetails);
router.patch('/shipments/:id/status', shipmentController.updateShipmentStatus);

// User Management
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserProfile);
router.patch('/users/:userId/tier', adminController.setUserTier);

// Contact Messages
router.get('/contact-messages', adminController.getContactMessages);
router.patch('/contact-messages/:id/status', adminController.markContactMessageAsRead);

// Tiers
router.get('/tiers', adminController.getTiers);
router.post('/tiers', adminController.createTier);
router.put('/tiers/:id', adminController.updateTier);
router.delete('/tiers/:id', adminController.deleteTier);

export default router;
