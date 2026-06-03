const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const coinPurchaseController = require('../controllers/coinPurchaseController');

router.use(auth);
router.get('/packages', coinPurchaseController.getCoinPackages);
router.post('/create-checkout-session', coinPurchaseController.createCheckoutSession);
router.post('/verify-payment', coinPurchaseController.verifyPayment);
router.get('/balance', coinPurchaseController.getCoinBalance);

// Webhook endpoint (no auth required)
router.post('/webhook', express.raw({type: 'application/json'}), coinPurchaseController.handleStripeWebhook);

module.exports = router;