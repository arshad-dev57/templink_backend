// routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const invoiceController = require('../controllers/invoiceController');

// All routes require authentication
router.use(auth);

// ==================== INVOICE ROUTES ====================

// Get my invoices (employer or employee)
router.get('/my-invoices', invoiceController.getMyInvoices);

// Get invoice statistics
router.get('/statistics', invoiceController.getInvoiceStatistics);

// Get single invoice by ID
router.get('/:invoiceId', invoiceController.getInvoiceById);

// Download invoice PDF
router.get('/:invoiceId/download', invoiceController.downloadInvoicePDF);

// Get project invoice
router.get('/project/:projectId', invoiceController.getProjectInvoice);

module.exports = router;