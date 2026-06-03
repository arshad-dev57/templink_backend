const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const walletController = require('../controllers/wallet_controller');
const stripeConnectController = require('../controllers/stripeConnectController');

// ==================== USER ROUTES (require auth) ====================
router.use(auth);

// Wallet - Basic
router.get('/balance', walletController.getWalletBalance);
router.get('/details', walletController.getWalletDetails);
router.get('/transactions', walletController.getTransactionHistory);
router.post('/add-funds', walletController.addFunds);
router.post('/pay', walletController.processWalletPayment);

// ==================== DEPOSIT ROUTES ====================
router.post('/deposit/create-intent', stripeConnectController.createDepositIntent);
router.post('/deposit/confirm', stripeConnectController.confirmDeposit);
router.post('/deposit/create-checkout', stripeConnectController.createDepositCheckout);

// ==================== STRIPE CONNECT ROUTES ====================
router.post('/connect/create', stripeConnectController.createConnectAccount);
router.get('/connect/status', stripeConnectController.checkAccountStatus);

// ==================== WITHDRAWAL ROUTES ====================
router.post('/withdraw', stripeConnectController.createWithdrawal);
router.get('/withdrawals', stripeConnectController.getWithdrawalHistory);
router.get('/withdrawals/:withdrawalId', stripeConnectController.getWithdrawalDetails);

// ==================== ADMIN ROUTES ====================
router.get('/admin/withdrawals/pending', auth, stripeConnectController.getPendingWithdrawals);
router.post('/admin/withdrawals/:withdrawalId/complete', auth, stripeConnectController.markWithdrawalCompleted);
router.post('/admin/withdrawals/:withdrawalId/fail', auth, stripeConnectController.markWithdrawalFailed);

// ==================== WEBHOOK (no auth - public) ====================
router.post('/webhook', express.raw({type: 'application/json'}), stripeConnectController.handleStripeWebhook);

module.exports = router;