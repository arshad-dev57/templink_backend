const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const coinPurchaseController = require('../controllers/coinPurchaseController');

// All routes require authentication
router.use(auth);

// Get available coin packages
router.get('/packages', coinPurchaseController.getCoinPackages);

// Create payment intent for coins
router.post('/create-payment', coinPurchaseController.createCoinPaymentIntent);

// Verify payment and add coins
router.post('/verify-payment', coinPurchaseController.verifyCoinPayment);

// Get current coin balance
router.get('/balance', coinPurchaseController.getCoinBalance);

module.exports = router;