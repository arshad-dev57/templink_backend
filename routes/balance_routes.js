// routes/milestonePaymentRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const walletcontroller = require('../controllers/wallet_controller');

// All routes require authentication
router.use(auth);
router.get('/mybalance', walletcontroller.getWalletBalance);
module.exports = router;