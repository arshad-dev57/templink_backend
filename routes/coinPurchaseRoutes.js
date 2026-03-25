const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const coinPurchaseController = require('../controllers/coinPurchaseController');

router.use(auth);
router.get('/packages', coinPurchaseController.getCoinPackages);
router.post('/create-payment', coinPurchaseController.createCoinPaymentIntent);
router.post('/verify-payment', coinPurchaseController.verifyCoinPayment);
router.get('/balance', coinPurchaseController.getCoinBalance);

module.exports = router;