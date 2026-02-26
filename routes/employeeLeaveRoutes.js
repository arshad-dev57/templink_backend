const express = require('express');
const router = express.Router();
const  auth  = require('../middleware/auth_middleware');
const {
  employeeLeft,
  checkJobProtection
} = require('../controllers/employeeLeaveController');

// Employee left route
router.patch('/application/:applicationId/left', auth, employeeLeft);

// Check job protection status
router.get('/job/:jobId/protection', auth, checkJobProtection);

module.exports = router;