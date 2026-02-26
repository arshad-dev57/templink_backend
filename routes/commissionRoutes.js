     // routes/commissionRoutes.js
const express = require('express');
const router = express.Router();
const  auth  = require('../middleware/auth_middleware');
const {
  createCommissionPaymentIntent,
  verifyCommissionPayment,
  getCommissionHistory
} = require('../controllers/commissionPaymentController');

// Employer routes
router.post('/create-payment', auth, createCommissionPaymentIntent);
router.post('/verify-payment', auth, verifyCommissionPayment);
// Admin routes
router.get('/history', auth, getCommissionHistory); // Add admin check

module.exports = router;