// routes/milestonePaymentRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const milestonePaymentController = require('../controllers/milestone_payment_controller');

// All routes require authentication
router.use(auth);
router.post('/create-payment-intent', milestonePaymentController.createPaymentIntent);
router.post('/verify-payment', milestonePaymentController.verifyPayment);

// Wallet payment
router.post('/pay-with-wallet', milestonePaymentController.payWithWallet);

// History and status
router.get('/history', milestonePaymentController.getPaymentHistory);
router.get('/milestone/:projectId/:milestoneId', milestonePaymentController.getMilestonePaymentStatus);

module.exports = router;