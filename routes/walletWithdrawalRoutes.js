const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const withdrawalController = require('../controllers/withdrawalController');

// ==================== USER ROUTES ====================
router.use(auth);

// Wallet
router.get('/details', withdrawalController.getWalletDetails);
router.get('/transactions', withdrawalController.getTransactionHistory);

// Withdrawals
router.post('/withdraw', withdrawalController.requestWithdrawal);
router.get('/withdrawals', withdrawalController.getWithdrawalHistory);
router.get('/withdrawals/:withdrawalId', withdrawalController.getWithdrawalDetails);
router.post('/withdrawals/:withdrawalId/cancel', withdrawalController.cancelWithdrawal);

// ==================== ADMIN ROUTES ====================
router.get('/admin/withdrawals/pending', auth, withdrawalController.getPendingWithdrawals);
router.post('/admin/withdrawals/:withdrawalId/complete', auth, withdrawalController.markWithdrawalCompleted);
router.post('/admin/withdrawals/:withdrawalId/fail', auth, withdrawalController.markWithdrawalFailed);

module.exports = router;